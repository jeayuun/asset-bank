-- Phase 2: RLS for terms, lessons, taxonomies, taxonomy_terms
-- (docs/BLUEPRINT.md §4.6). Same pattern as the Phase 1 rls_policies
-- migration: FORCE RLS, revoke Supabase's default grants, grant back only
-- what the policy table calls for, then add the policies themselves.

-- ── terms / lessons ─────────────────────────────────────────────────────
alter table public.terms enable row level security;
alter table public.terms force row level security;
alter table public.lessons enable row level security;
alter table public.lessons force row level security;

revoke all on public.terms from anon, authenticated;
grant select, insert, update on public.terms to authenticated;
revoke all on public.lessons from anon, authenticated;
grant select, insert, update on public.lessons to authenticated;

create policy terms_select on public.terms
  for select
  to authenticated
  using ((select app.is_active()));

create policy terms_insert on public.terms
  for insert
  to authenticated
  with check ((select app.is_admin()));

create policy terms_update on public.terms
  for update
  to authenticated
  using ((select app.is_admin()))
  with check ((select app.is_admin()));

create policy lessons_select on public.lessons
  for select
  to authenticated
  using ((select app.is_active()));

create policy lessons_insert on public.lessons
  for insert
  to authenticated
  with check ((select app.is_admin()));

create policy lessons_update on public.lessons
  for update
  to authenticated
  using ((select app.is_admin()))
  with check ((select app.is_admin()));

-- ── taxonomies / taxonomy_terms ─────────────────────────────────────────
alter table public.taxonomies enable row level security;
alter table public.taxonomies force row level security;
alter table public.taxonomy_terms enable row level security;
alter table public.taxonomy_terms force row level security;

revoke all on public.taxonomies from anon, authenticated;
grant select, insert, update on public.taxonomies to authenticated;
revoke all on public.taxonomy_terms from anon, authenticated;
grant select, insert, update on public.taxonomy_terms to authenticated;

create policy taxonomies_select on public.taxonomies
  for select
  to authenticated
  using ((select app.is_active()));

create policy taxonomies_insert on public.taxonomies
  for insert
  to authenticated
  with check ((select app.is_super()));

create policy taxonomies_update on public.taxonomies
  for update
  to authenticated
  using ((select app.is_super()))
  with check ((select app.is_super()));

create policy taxonomy_terms_select on public.taxonomy_terms
  for select
  to authenticated
  using ((select app.is_active()));

create policy taxonomy_terms_insert on public.taxonomy_terms
  for insert
  to authenticated
  with check ((select app.is_super()));

create policy taxonomy_terms_update on public.taxonomy_terms
  for update
  to authenticated
  using ((select app.is_super()))
  with check ((select app.is_super()));

-- ── audit ────────────────────────────────────────────────────────────────
create trigger audit_terms
  after insert or update or delete on public.terms
  for each row execute function app.audit_trigger();

create trigger audit_lessons
  after insert or update or delete on public.lessons
  for each row execute function app.audit_trigger();

create trigger audit_taxonomies
  after insert or update or delete on public.taxonomies
  for each row execute function app.audit_trigger();

create trigger audit_taxonomy_terms
  after insert or update or delete on public.taxonomy_terms
  for each row execute function app.audit_trigger();
