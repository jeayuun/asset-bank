-- Run once, by a human, over a direct connection to the target database
-- (SUPABASE_DB_URL — never from the app). Promotes an existing profile to
-- Super Admin. app.grant_super_admin()'s EXECUTE is revoked from anon and
-- authenticated, so PostgREST cannot reach it (docs/DECISIONS.md D-04).
--
-- Usage:
--   psql "$SUPABASE_DB_URL" -v target_id="'00000000-0000-0000-0000-000000000000'" -f scripts/grant-super-admin.sql

select app.grant_super_admin(:target_id::uuid);
