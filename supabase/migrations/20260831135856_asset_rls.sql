-- Phase 3: RLS for asset_types, assets, join tables, tags
-- (docs/BLUEPRINT.md §4.6). Same pattern as prior phases: FORCE RLS,
-- revoke Supabase's default grants, grant back only what the policy
-- table calls for, then the policies themselves.

-- ── asset_types ─────────────────────────────────────────────────────────
-- Grouped with taxonomies in §4.6's policy table: INSERT/UPDATE is
-- is_super(), not is_admin() — matches "Create new asset types" being
-- Super-Admin-only in §6.
alter table public.asset_types enable row level security;
alter table public.asset_types force row level security;

revoke all on public.asset_types from anon, authenticated;
grant select, insert, update on public.asset_types to authenticated;

create policy asset_types_select on public.asset_types
  for select
  to authenticated
  using ((select app.is_active()));

create policy asset_types_insert on public.asset_types
  for insert
  to authenticated
  with check ((select app.is_super()));

create policy asset_types_update on public.asset_types
  for update
  to authenticated
  using ((select app.is_super()))
  with check ((select app.is_super()));

-- ── taxonomy_asset_types ────────────────────────────────────────────────
alter table public.taxonomy_asset_types enable row level security;
alter table public.taxonomy_asset_types force row level security;

revoke all on public.taxonomy_asset_types from anon, authenticated;
grant select, insert, update on public.taxonomy_asset_types to authenticated;

create policy taxonomy_asset_types_select on public.taxonomy_asset_types
  for select
  to authenticated
  using ((select app.is_active()));

create policy taxonomy_asset_types_insert on public.taxonomy_asset_types
  for insert
  to authenticated
  with check ((select app.is_super()));

create policy taxonomy_asset_types_update on public.taxonomy_asset_types
  for update
  to authenticated
  using ((select app.is_super()))
  with check ((select app.is_super()));

-- ── assets ──────────────────────────────────────────────────────────────
-- A Viewer sees published assets only; Admin+ sees everything
-- (docs/DECISIONS.md D-11).
alter table public.assets enable row level security;
alter table public.assets force row level security;

revoke all on public.assets from anon, authenticated;
grant select, insert, update on public.assets to authenticated;

create policy assets_select on public.assets
  for select
  to authenticated
  using ((select app.is_active()) and (status = 'published' or (select app.is_admin())));

create policy assets_insert on public.assets
  for insert
  to authenticated
  with check ((select app.is_admin()));

create policy assets_update on public.assets
  for update
  to authenticated
  using ((select app.is_admin()))
  with check ((select app.is_admin()));

-- ── asset_* join tables ─────────────────────────────────────────────────
-- SELECT inherits the parent asset's visibility; writes are Admin+.
alter table public.asset_key_stages enable row level security;
alter table public.asset_key_stages force row level security;
alter table public.asset_grades enable row level security;
alter table public.asset_grades force row level security;
alter table public.asset_lessons enable row level security;
alter table public.asset_lessons force row level security;
alter table public.asset_taxonomy_terms enable row level security;
alter table public.asset_taxonomy_terms force row level security;
alter table public.asset_tags enable row level security;
alter table public.asset_tags force row level security;

revoke all on public.asset_key_stages from anon, authenticated;
grant select, insert, update, delete on public.asset_key_stages to authenticated;
revoke all on public.asset_grades from anon, authenticated;
grant select, insert, update, delete on public.asset_grades to authenticated;
revoke all on public.asset_lessons from anon, authenticated;
grant select, insert, update, delete on public.asset_lessons to authenticated;
revoke all on public.asset_taxonomy_terms from anon, authenticated;
grant select, insert, update, delete on public.asset_taxonomy_terms to authenticated;
revoke all on public.asset_tags from anon, authenticated;
grant select, insert, update, delete on public.asset_tags to authenticated;

create policy asset_key_stages_select on public.asset_key_stages
  for select
  to authenticated
  using (exists (select 1 from public.assets a where a.id = asset_id));

create policy asset_key_stages_insert on public.asset_key_stages
  for insert
  to authenticated
  with check ((select app.is_admin()));

create policy asset_key_stages_update on public.asset_key_stages
  for update
  to authenticated
  using ((select app.is_admin()))
  with check ((select app.is_admin()));

create policy asset_key_stages_delete on public.asset_key_stages
  for delete
  to authenticated
  using ((select app.is_admin()));

create policy asset_grades_select on public.asset_grades
  for select
  to authenticated
  using (exists (select 1 from public.assets a where a.id = asset_id));

create policy asset_grades_insert on public.asset_grades
  for insert
  to authenticated
  with check ((select app.is_admin()));

create policy asset_grades_update on public.asset_grades
  for update
  to authenticated
  using ((select app.is_admin()))
  with check ((select app.is_admin()));

create policy asset_grades_delete on public.asset_grades
  for delete
  to authenticated
  using ((select app.is_admin()));

create policy asset_lessons_select on public.asset_lessons
  for select
  to authenticated
  using (exists (select 1 from public.assets a where a.id = asset_id));

create policy asset_lessons_insert on public.asset_lessons
  for insert
  to authenticated
  with check ((select app.is_admin()));

create policy asset_lessons_update on public.asset_lessons
  for update
  to authenticated
  using ((select app.is_admin()))
  with check ((select app.is_admin()));

create policy asset_lessons_delete on public.asset_lessons
  for delete
  to authenticated
  using ((select app.is_admin()));

create policy asset_taxonomy_terms_select on public.asset_taxonomy_terms
  for select
  to authenticated
  using (exists (select 1 from public.assets a where a.id = asset_id));

create policy asset_taxonomy_terms_insert on public.asset_taxonomy_terms
  for insert
  to authenticated
  with check ((select app.is_admin()));

create policy asset_taxonomy_terms_update on public.asset_taxonomy_terms
  for update
  to authenticated
  using ((select app.is_admin()))
  with check ((select app.is_admin()));

create policy asset_taxonomy_terms_delete on public.asset_taxonomy_terms
  for delete
  to authenticated
  using ((select app.is_admin()));

create policy asset_tags_select on public.asset_tags
  for select
  to authenticated
  using (exists (select 1 from public.assets a where a.id = asset_id));

create policy asset_tags_insert on public.asset_tags
  for insert
  to authenticated
  with check ((select app.is_admin()));

create policy asset_tags_update on public.asset_tags
  for update
  to authenticated
  using ((select app.is_admin()))
  with check ((select app.is_admin()));

create policy asset_tags_delete on public.asset_tags
  for delete
  to authenticated
  using ((select app.is_admin()));

-- ── tags ────────────────────────────────────────────────────────────────
-- Not in the §4.6 table explicitly; treated as a simple admin-managed
-- lookup, consistent with every other reference table.
alter table public.tags enable row level security;
alter table public.tags force row level security;

revoke all on public.tags from anon, authenticated;
grant select, insert on public.tags to authenticated;

create policy tags_select on public.tags
  for select
  to authenticated
  using ((select app.is_active()));

create policy tags_insert on public.tags
  for insert
  to authenticated
  with check ((select app.is_admin()));

-- ── audit ───────────────────────────────────────────────────────────────
create trigger audit_asset_types
  after insert or update or delete on public.asset_types
  for each row execute function app.audit_trigger();

create trigger audit_assets
  after insert or update or delete on public.assets
  for each row execute function app.audit_trigger();
