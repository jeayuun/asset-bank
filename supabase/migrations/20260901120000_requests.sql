-- Phase 7: asset requests (docs/BLUEPRINT.md §5.6/§9, docs/DECISIONS.md D-10).
--
-- Requests are private by default (D-10): a Viewer sees a request only if
-- they created it or are a watcher. app.can_see_request() is a
-- SECURITY DEFINER function rather than an inline policy expression,
-- specifically to avoid a policy cycle between asset_requests and
-- request_watchers (each would need to query the other's RLS-filtered
-- rows to decide visibility).

create type public.request_status as enum (
  'submitted', 'under_review', 'approved', 'in_progress',
  'on_hold', 'completed', 'rejected', 'cancelled'
);

create type public.request_priority as enum ('low', 'normal', 'high', 'urgent');

create sequence app.request_reference_seq;

-- nextval() needs explicit USAGE on the sequence — unlike table SELECT
-- privileges, it isn't implied by anything else authenticated already
-- has, and app.set_request_reference() below runs as the calling role,
-- not the sequence owner.
grant usage on sequence app.request_reference_seq to authenticated;

create table public.asset_requests (
  id uuid primary key default gen_random_uuid(),
  reference text not null unique,
  title text not null check (btrim(title) <> '' and length(title) <= 200),
  description text,
  requested_by uuid not null references public.profiles (id),
  asset_type_id uuid references public.asset_types (id) on delete restrict,
  key_stage_id uuid references public.key_stages (id) on delete restrict,
  grade_id uuid references public.grades (id) on delete restrict,
  lesson_id uuid references public.lessons (id) on delete restrict,
  priority public.request_priority not null default 'normal',
  needed_by date,
  status public.request_status not null default 'submitted',
  assigned_to uuid references public.profiles (id),
  closed_at timestamptz,
  closed_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_updated_at
  before update on public.asset_requests
  for each row execute function app.set_updated_at();

create index asset_requests_status_idx on public.asset_requests (status);
create index asset_requests_requested_by_idx on public.asset_requests (requested_by);
create index asset_requests_assigned_to_idx on public.asset_requests (assigned_to);

-- Trigger-derived, always overwritten — same "stored value can never
-- drift" reasoning as lesson codes (docs/DECISIONS.md D-09). Format:
-- REQ-0001.
create function app.set_request_reference()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.reference := 'REQ-' || lpad(nextval('app.request_reference_seq')::text, 4, '0');
  return new;
end;
$$;

create trigger set_request_reference
  before insert on public.asset_requests
  for each row execute function app.set_request_reference();

create table public.request_comments (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.asset_requests (id) on delete cascade,
  author_id uuid not null references public.profiles (id),
  body text not null check (btrim(body) <> ''),
  edited_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz not null default now()
);

create index request_comments_request_id_idx on public.request_comments (request_id);

create table public.request_deliverables (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.asset_requests (id) on delete cascade,
  asset_id uuid references public.assets (id),
  drive_url text,
  label text not null check (btrim(label) <> ''),
  added_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  check (asset_id is not null or drive_url is not null)
);

create index request_deliverables_request_id_idx on public.request_deliverables (request_id);

create table public.request_status_history (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.asset_requests (id) on delete cascade,
  from_status public.request_status,
  to_status public.request_status not null,
  changed_by uuid references public.profiles (id),
  note text,
  created_at timestamptz not null default now()
);

create index request_status_history_request_id_idx on public.request_status_history (request_id);

create table public.request_watchers (
  request_id uuid not null references public.asset_requests (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (request_id, profile_id)
);

-- ── app.can_see_request() (docs/BLUEPRINT.md §9, docs/DECISIONS.md D-10) ──
create function app.can_see_request(p_request_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    (select app.is_admin())
    or exists (
      select 1 from public.asset_requests r
      where r.id = p_request_id and r.requested_by = app.uid()
    )
    or exists (
      select 1 from public.request_watchers w
      where w.request_id = p_request_id and w.profile_id = app.uid()
    );
$$;

revoke execute on function app.can_see_request(uuid) from public;
grant execute on function app.can_see_request(uuid) to authenticated;

-- Displaying who requested, who's assigned, who commented, and who's
-- watching all need an email — but `profiles` SELECT is
-- `id = uid() OR is_admin()` (§4.6), so a non-admin who can see the
-- request still can't read a stranger's profile row directly (same
-- problem as docs/PROGRESS.md's Phase 6 collection-member-emails entry).
-- Scoped to exactly the visibility app.can_see_request() already grants
-- the caller, so this can never disclose more than the request itself
-- already does.
create function app.request_participant_emails(p_request_id uuid)
returns table (profile_id uuid, email public.citext)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, p.email
  from public.profiles p
  where (select app.can_see_request(p_request_id))
    and p.id in (
      select requested_by from public.asset_requests where id = p_request_id
      union
      select assigned_to from public.asset_requests where id = p_request_id and assigned_to is not null
      union
      select author_id from public.request_comments where request_id = p_request_id
      union
      select profile_id from public.request_watchers where request_id = p_request_id
    );
$$;

revoke execute on function app.request_participant_emails(uuid) from public;
grant execute on function app.request_participant_emails(uuid) to authenticated;

-- The requester is auto-added as a watcher on creation; commenters are
-- auto-added too (docs/BLUEPRINT.md §5.6). Both need SECURITY DEFINER —
-- a plain trigger function still executes with the CALLING role's
-- privileges (subject to RLS), not the table owner's; only SECURITY
-- DEFINER runs as the function's owner. Without it, a Viewer's own
-- request/comment insert fails outright, because request_watchers'
-- INSERT policy is Admin+ only for direct writes.
create function app.watch_request_on_create()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.request_watchers (request_id, profile_id)
  values (new.id, new.requested_by)
  on conflict do nothing;
  return new;
end;
$$;

create trigger watch_request_on_create
  after insert on public.asset_requests
  for each row execute function app.watch_request_on_create();

create function app.watch_request_on_comment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.request_watchers (request_id, profile_id)
  values (new.request_id, new.author_id)
  on conflict do nothing;
  return new;
end;
$$;

create trigger watch_request_on_comment
  after insert on public.request_comments
  for each row execute function app.watch_request_on_comment();

-- ── app.change_request_status() (docs/BLUEPRINT.md §9) ────────────────────
-- The transition matrix, the per-status requirement, the actor check, and
-- the request_status_history row all have to happen atomically and the
-- note (only meaningful alongside a status change) has to travel with the
-- transition — none of that fits a plain column UPDATE, so status changes
-- go through this RPC rather than a direct grant on `status` (same
-- reasoning as profiles.role/status/is_owner in docs/BLUEPRINT.md §4.6).
create function app.change_request_status(
  p_request_id uuid,
  p_new_status public.request_status,
  p_note text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_old_status public.request_status;
  v_requested_by uuid;
  v_assigned_to uuid;
  v_deliverable_count int;
  v_is_admin boolean := app.is_admin();
  v_is_requester boolean;
begin
  select status, requested_by, assigned_to
    into v_old_status, v_requested_by, v_assigned_to
  from public.asset_requests
  where id = p_request_id;

  if v_old_status is null then
    raise exception 'no request found for %', p_request_id;
  end if;

  v_is_requester := (v_requested_by = auth.uid());

  if v_old_status = p_new_status then
    raise exception 'request is already %', p_new_status;
  end if;

  -- Transition matrix (docs/BLUEPRINT.md §9's diagram).
  if v_old_status = 'submitted' and p_new_status = 'under_review' then
    if not v_is_admin then
      raise exception 'only Admin+ may move a request to under_review';
    end if;
  elsif v_old_status in ('submitted', 'under_review') and p_new_status = 'cancelled' then
    if not (v_is_admin or v_is_requester) then
      raise exception 'only the requester or Admin+ may cancel a request';
    end if;
  elsif v_old_status = 'under_review' and p_new_status = 'approved' then
    if not v_is_admin then
      raise exception 'only Admin+ may approve a request';
    end if;
  elsif v_old_status in ('under_review', 'approved') and p_new_status = 'rejected' then
    if not v_is_admin then
      raise exception 'only Admin+ may reject a request';
    end if;
    if p_note is null or btrim(p_note) = '' then
      raise exception 'rejecting a request requires a note';
    end if;
  elsif v_old_status = 'approved' and p_new_status = 'in_progress' then
    if not v_is_admin then
      raise exception 'only Admin+ may start work on a request';
    end if;
    if v_assigned_to is null then
      raise exception 'assign the request before moving it to in_progress';
    end if;
  elsif v_old_status = 'in_progress' and p_new_status = 'on_hold' then
    if not v_is_admin then
      raise exception 'only Admin+ may put a request on hold';
    end if;
    if p_note is null or btrim(p_note) = '' then
      raise exception 'putting a request on hold requires a note';
    end if;
  elsif v_old_status = 'on_hold' and p_new_status = 'in_progress' then
    if not v_is_admin then
      raise exception 'only Admin+ may resume a request';
    end if;
  elsif v_old_status = 'in_progress' and p_new_status = 'completed' then
    if not v_is_admin then
      raise exception 'only Admin+ may complete a request';
    end if;
    select count(*) into v_deliverable_count
    from public.request_deliverables
    where request_id = p_request_id;
    if v_deliverable_count = 0 then
      raise exception 'completing a request requires at least one deliverable';
    end if;
  elsif v_old_status in ('completed', 'rejected', 'cancelled') and p_new_status = 'under_review' then
    if not v_is_admin then
      raise exception 'only Admin+ may reopen a closed request';
    end if;
  else
    raise exception '% is not a valid transition from %', p_new_status, v_old_status;
  end if;

  update public.asset_requests
  set
    status = p_new_status,
    closed_at = case
      when p_new_status in ('completed', 'rejected', 'cancelled') then now()
      when p_new_status = 'under_review' then null
      else closed_at
    end,
    closed_reason = case
      when p_new_status in ('completed', 'rejected', 'cancelled') then p_note
      when p_new_status = 'under_review' then null
      else closed_reason
    end
  where id = p_request_id;

  insert into public.request_status_history (request_id, from_status, to_status, changed_by, note)
  values (p_request_id, v_old_status, p_new_status, auth.uid(), p_note);
end;
$$;

revoke execute on function app.change_request_status(uuid, public.request_status, text) from public;
grant execute on function app.change_request_status(uuid, public.request_status, text) to authenticated;

-- ── app.assign_request() ───────────────────────────────────────────────
create function app.assign_request(p_request_id uuid, p_assignee_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_assignee_role public.role_enum;
begin
  if not app.is_admin() then
    raise exception 'only Admin+ may assign a request';
  end if;

  select role into v_assignee_role from public.profiles where id = p_assignee_id;
  if v_assignee_role is null then
    raise exception 'no profile found for %', p_assignee_id;
  end if;
  if v_assignee_role not in ('admin', 'super_admin') then
    raise exception 'a request can only be assigned to an Admin or Super Admin';
  end if;

  update public.asset_requests set assigned_to = p_assignee_id where id = p_request_id;
end;
$$;

revoke execute on function app.assign_request(uuid, uuid) from public;
grant execute on function app.assign_request(uuid, uuid) to authenticated;

-- ── RLS (docs/BLUEPRINT.md §4.6) ──────────────────────────────────────────
alter table public.asset_requests enable row level security;
alter table public.asset_requests force row level security;

revoke all on public.asset_requests from anon, authenticated;
grant select, insert, update on public.asset_requests to authenticated;
-- status, assigned_to, closed_at, closed_reason are deliberately excluded
-- from the update grant — they change only through the RPCs above, same
-- reasoning as profiles.role/status/is_owner (docs/BLUEPRINT.md §4.6).
grant update (title, description, asset_type_id, key_stage_id, grade_id, lesson_id, priority, needed_by)
  on public.asset_requests to authenticated;

create policy asset_requests_select on public.asset_requests
  for select
  to authenticated
  using ((select app.can_see_request(id)));

create policy asset_requests_insert on public.asset_requests
  for insert
  to authenticated
  with check ((select app.is_active()) and requested_by = (select app.uid()));

create policy asset_requests_update on public.asset_requests
  for update
  to authenticated
  using (requested_by = (select app.uid()) or (select app.is_admin()))
  with check (
    (select app.is_admin())
    or (requested_by = (select app.uid()) and status = 'submitted')
  );

-- ── request_comments ───────────────────────────────────────────────────
alter table public.request_comments enable row level security;
alter table public.request_comments force row level security;

revoke all on public.request_comments from anon, authenticated;
grant select, insert on public.request_comments to authenticated;
grant update (body, edited_at, deleted_at) on public.request_comments to authenticated;

create policy request_comments_select on public.request_comments
  for select
  to authenticated
  using ((select app.can_see_request(request_id)));

create policy request_comments_insert on public.request_comments
  for insert
  to authenticated
  with check (
    (select app.is_active())
    and author_id = (select app.uid())
    and (select app.can_see_request(request_id))
  );

create policy request_comments_update on public.request_comments
  for update
  to authenticated
  using (author_id = (select app.uid()) or (select app.is_admin()))
  with check (author_id = (select app.uid()) or (select app.is_admin()));

-- ── request_deliverables ───────────────────────────────────────────────
alter table public.request_deliverables enable row level security;
alter table public.request_deliverables force row level security;

revoke all on public.request_deliverables from anon, authenticated;
grant select, insert on public.request_deliverables to authenticated;

create policy request_deliverables_select on public.request_deliverables
  for select
  to authenticated
  using ((select app.can_see_request(request_id)));

create policy request_deliverables_insert on public.request_deliverables
  for insert
  to authenticated
  with check ((select app.is_admin()));

-- ── request_status_history ─────────────────────────────────────────────
-- No direct write grant at all — every row is written by
-- app.change_request_status(), running as the table owner.
alter table public.request_status_history enable row level security;
alter table public.request_status_history force row level security;

revoke all on public.request_status_history from anon, authenticated;
grant select on public.request_status_history to authenticated;

create policy request_status_history_select on public.request_status_history
  for select
  to authenticated
  using ((select app.can_see_request(request_id)));

-- ── request_watchers ───────────────────────────────────────────────────
-- Direct INSERT is Admin+ only (§9: "Admins can pull a Viewer into a
-- request by adding them as a watcher"). The auto-watch triggers above
-- bypass this — they run as the table owner, not through PostgREST.
alter table public.request_watchers enable row level security;
alter table public.request_watchers force row level security;

revoke all on public.request_watchers from anon, authenticated;
grant select, insert, delete on public.request_watchers to authenticated;

create policy request_watchers_select on public.request_watchers
  for select
  to authenticated
  using ((select app.can_see_request(request_id)));

create policy request_watchers_insert on public.request_watchers
  for insert
  to authenticated
  with check ((select app.is_admin()));

create policy request_watchers_delete on public.request_watchers
  for delete
  to authenticated
  using ((select app.is_admin()));

-- ── audit ───────────────────────────────────────────────────────────────
create trigger audit_asset_requests
  after insert or update or delete on public.asset_requests
  for each row execute function app.audit_trigger();
