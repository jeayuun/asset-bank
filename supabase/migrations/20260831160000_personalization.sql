-- Phase 6: favorites and collections (docs/BLUEPRINT.md §5.5, §11).
--
-- Two of the Blueprint's own "open decisions" (§17) are resolved here with
-- its stated default rather than blocked on: team-collection editing is
-- owner + explicit editing members, with Super Admin override; managing
-- membership itself (collection_members) is owner/Super-Admin only — not
-- in the §4.6 table, this session's own inference, since letting an
-- arbitrary editing member add/remove other members isn't specified
-- anywhere. Both are flagged in docs/PROGRESS.md for the owner to confirm.

create type public.collection_visibility as enum ('personal', 'team');

create table public.favorites (
  profile_id uuid not null references public.profiles (id) on delete cascade,
  asset_id uuid not null references public.assets (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (profile_id, asset_id)
);

create table public.collections (
  id uuid primary key default gen_random_uuid(),
  name text not null check (btrim(name) <> '' and length(name) <= 160),
  description text,
  owner_id uuid not null references public.profiles (id),
  visibility public.collection_visibility not null default 'personal',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_updated_at
  before update on public.collections
  for each row execute function app.set_updated_at();

create table public.collection_items (
  collection_id uuid not null references public.collections (id) on delete cascade,
  asset_id uuid not null references public.assets (id) on delete cascade,
  position int not null default 0,
  added_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  primary key (collection_id, asset_id)
);

create table public.collection_members (
  collection_id uuid not null references public.collections (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  can_edit boolean not null default false,
  created_at timestamptz not null default now(),
  primary key (collection_id, profile_id)
);

-- Centralizes "owner, editing member, or Super Admin" — needed by
-- collections' own UPDATE policy and every collection_items write policy
-- (docs/BLUEPRINT.md §4.6: "parent editable"). SECURITY DEFINER so it can
-- read collection_members without depending on collection_members' own
-- RLS, matching the app.is_admin()-style helper pattern used everywhere
-- else in this schema.
create function app.can_edit_collection(p_collection_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    (select app.is_super())
    or exists (
      select 1 from public.collections c
      where c.id = p_collection_id and c.owner_id = app.uid()
    )
    or exists (
      select 1 from public.collection_members cm
      where cm.collection_id = p_collection_id
        and cm.profile_id = app.uid()
        and cm.can_edit
    );
$$;

revoke execute on function app.can_edit_collection(uuid) from public;
grant execute on function app.can_edit_collection(uuid) to authenticated;

-- Adding a collection member by email needs to resolve that email to a
-- profile id, but `profiles` SELECT is `id = uid() OR is_admin()`
-- (§4.6) — a non-admin collection owner can't see another user's row
-- directly. This is a narrow, exact-match-only lookup (no name, no
-- partial search) so it discloses only "does this exact email have an
-- account," not a general directory.
create function app.find_profile_id_by_email(p_email public.citext)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select id from public.profiles where email = p_email and status = 'active';
$$;

revoke execute on function app.find_profile_id_by_email(public.citext) from public;
grant execute on function app.find_profile_id_by_email(public.citext) to authenticated;

-- Same problem in reverse: displaying a collection's member list needs
-- each member's email, but a non-admin can't read another user's
-- `profiles` row directly. Scoped to exactly the visibility collections'
-- own SELECT policy already grants the caller — this never discloses a
-- membership the caller couldn't already see the collection for.
create function app.collection_member_emails(p_collection_id uuid)
returns table (profile_id uuid, email public.citext)
language sql
stable
security definer
set search_path = ''
as $$
  select cm.profile_id, p.email
  from public.collection_members cm
  join public.profiles p on p.id = cm.profile_id
  where cm.collection_id = p_collection_id
    and exists (
      select 1 from public.collections c
      where c.id = p_collection_id
        and (c.owner_id = app.uid() or c.visibility = 'team' or app.is_super())
    );
$$;

revoke execute on function app.collection_member_emails(uuid) from public;
grant execute on function app.collection_member_emails(uuid) to authenticated;

-- ── RLS (docs/BLUEPRINT.md §4.6) ──────────────────────────────────────────

-- favorites: profile_id = uid() | same | — | same
alter table public.favorites enable row level security;
alter table public.favorites force row level security;

revoke all on public.favorites from anon, authenticated;
grant select, insert, delete on public.favorites to authenticated;

create policy favorites_select on public.favorites
  for select
  to authenticated
  using (profile_id = (select app.uid()));

create policy favorites_insert on public.favorites
  for insert
  to authenticated
  with check (profile_id = (select app.uid()));

create policy favorites_delete on public.favorites
  for delete
  to authenticated
  using (profile_id = (select app.uid()));

-- collections: owner_id = uid() OR visibility='team' OR is_super() |
-- is_active() | owner, editing member, or is_super() | owner or is_super()
alter table public.collections enable row level security;
alter table public.collections force row level security;

revoke all on public.collections from anon, authenticated;
grant select, insert, update, delete on public.collections to authenticated;

create policy collections_select on public.collections
  for select
  to authenticated
  using (
    owner_id = (select app.uid())
    or visibility = 'team'
    or (select app.is_super())
  );

create policy collections_insert on public.collections
  for insert
  to authenticated
  with check ((select app.is_active()) and owner_id = (select app.uid()));

create policy collections_update on public.collections
  for update
  to authenticated
  using ((select app.can_edit_collection(id)))
  with check ((select app.can_edit_collection(id)));

create policy collections_delete on public.collections
  for delete
  to authenticated
  using (owner_id = (select app.uid()) or (select app.is_super()));

-- collection_items: parent collection visible | parent editable (x3)
alter table public.collection_items enable row level security;
alter table public.collection_items force row level security;

revoke all on public.collection_items from anon, authenticated;
grant select, insert, update, delete on public.collection_items to authenticated;

create policy collection_items_select on public.collection_items
  for select
  to authenticated
  using (exists (select 1 from public.collections c where c.id = collection_id));

create policy collection_items_insert on public.collection_items
  for insert
  to authenticated
  with check ((select app.can_edit_collection(collection_id)));

create policy collection_items_update on public.collection_items
  for update
  to authenticated
  using ((select app.can_edit_collection(collection_id)))
  with check ((select app.can_edit_collection(collection_id)));

create policy collection_items_delete on public.collection_items
  for delete
  to authenticated
  using ((select app.can_edit_collection(collection_id)));

-- collection_members: not in the §4.6 table. Select follows the parent
-- collection's own visibility; every write is owner/Super-Admin only
-- (this session's inference — see the top-of-file note).
alter table public.collection_members enable row level security;
alter table public.collection_members force row level security;

revoke all on public.collection_members from anon, authenticated;
grant select, insert, update, delete on public.collection_members to authenticated;

create policy collection_members_select on public.collection_members
  for select
  to authenticated
  using (exists (select 1 from public.collections c where c.id = collection_id));

create policy collection_members_insert on public.collection_members
  for insert
  to authenticated
  with check (
    exists (
      select 1 from public.collections c
      where c.id = collection_id
        and (c.owner_id = (select app.uid()) or (select app.is_super()))
    )
  );

create policy collection_members_update on public.collection_members
  for update
  to authenticated
  using (
    exists (
      select 1 from public.collections c
      where c.id = collection_id
        and (c.owner_id = (select app.uid()) or (select app.is_super()))
    )
  )
  with check (
    exists (
      select 1 from public.collections c
      where c.id = collection_id
        and (c.owner_id = (select app.uid()) or (select app.is_super()))
    )
  );

create policy collection_members_delete on public.collection_members
  for delete
  to authenticated
  using (
    exists (
      select 1 from public.collections c
      where c.id = collection_id
        and (c.owner_id = (select app.uid()) or (select app.is_super()))
    )
  );

-- ── audit ───────────────────────────────────────────────────────────────
-- Only the named entity, matching the convention set in Phase 2/3 (the
-- audit trail records taxonomies/assets, not their join tables).
create trigger audit_collections
  after insert or update or delete on public.collections
  for each row execute function app.audit_trigger();
