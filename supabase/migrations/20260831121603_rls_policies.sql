-- Phase 1: RLS enablement, grants, and policies for every table created so
-- far (docs/BLUEPRINT.md §4.6). FORCE ROW LEVEL SECURITY is applied to
-- every table except profiles — that exception is deliberate and is what
-- lets the app.* helpers read profiles without recursing (D-02). Policy
-- expressions call helpers as `(select app.is_admin())` so the planner
-- hoists the check to a single InitPlan per statement instead of
-- re-evaluating it per row (§4.2).
--
-- Supabase's default privileges grant ALL on new public tables to anon,
-- authenticated, and service_role at creation time. Every grant below is
-- deliberately re-derived from scratch (revoke, then grant back only what
-- §4.6 calls for) rather than trusting that default.

-- ── profiles ────────────────────────────────────────────────────────────
alter table public.profiles enable row level security;

revoke all on public.profiles from anon, authenticated;
grant select on public.profiles to authenticated;
-- role, status, and is_owner are deliberately excluded — they change only
-- through the SECURITY DEFINER RPCs in the admin_rpcs migration.
grant update (full_name, avatar_url, default_key_stage_id) on public.profiles to authenticated;
-- No INSERT grant: rows are created only by app.handle_new_user(), which
-- runs as the table owner and so is unaffected by RLS on a non-FORCE table.
-- No DELETE grant or policy anywhere: no hard delete (docs/DECISIONS.md D-05).

create policy profiles_select on public.profiles
  for select
  to authenticated
  using (id = (select app.uid()) or (select app.is_admin()));

create policy profiles_update_self on public.profiles
  for update
  to authenticated
  using (id = (select app.uid()))
  with check (id = (select app.uid()));

-- ── invitations ─────────────────────────────────────────────────────────
alter table public.invitations enable row level security;
alter table public.invitations force row level security;

revoke all on public.invitations from anon, authenticated;
grant select, insert, update on public.invitations to authenticated;

create policy invitations_select on public.invitations
  for select
  to authenticated
  using ((select app.is_super()));

create policy invitations_insert on public.invitations
  for insert
  to authenticated
  with check ((select app.is_super()));

create policy invitations_update on public.invitations
  for update
  to authenticated
  using ((select app.is_super()))
  with check ((select app.is_super()));

-- ── key_stages / grades ────────────────────────────────────────────────
alter table public.key_stages enable row level security;
alter table public.key_stages force row level security;
alter table public.grades enable row level security;
alter table public.grades force row level security;

revoke all on public.key_stages from anon, authenticated;
grant select, insert, update on public.key_stages to authenticated;
revoke all on public.grades from anon, authenticated;
grant select, insert, update on public.grades to authenticated;

create policy key_stages_select on public.key_stages
  for select
  to authenticated
  using ((select app.is_active()));

create policy key_stages_write on public.key_stages
  for insert
  to authenticated
  with check ((select app.is_admin()));

create policy key_stages_update on public.key_stages
  for update
  to authenticated
  using ((select app.is_admin()))
  with check ((select app.is_admin()));

create policy grades_select on public.grades
  for select
  to authenticated
  using ((select app.is_active()));

create policy grades_insert on public.grades
  for insert
  to authenticated
  with check ((select app.is_admin()));

create policy grades_update on public.grades
  for update
  to authenticated
  using ((select app.is_admin()))
  with check ((select app.is_admin()));

-- ── audit_log ───────────────────────────────────────────────────────────
alter table public.audit_log enable row level security;
alter table public.audit_log force row level security;

revoke all on public.audit_log from anon;
-- authenticated already lost insert/update/delete in the audit_and_settings
-- migration; SELECT is gated by the policy below.

create policy audit_log_select on public.audit_log
  for select
  to authenticated
  using ((select app.is_super()));

-- ── app_settings ────────────────────────────────────────────────────────
alter table public.app_settings enable row level security;
alter table public.app_settings force row level security;

revoke all on public.app_settings from anon, authenticated;
grant select, insert, update on public.app_settings to authenticated;

create policy app_settings_select on public.app_settings
  for select
  to authenticated
  using ((select app.is_super()));

create policy app_settings_insert on public.app_settings
  for insert
  to authenticated
  with check ((select app.is_super()));

create policy app_settings_update on public.app_settings
  for update
  to authenticated
  using ((select app.is_super()))
  with check ((select app.is_super()));
