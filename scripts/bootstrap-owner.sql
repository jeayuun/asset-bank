-- Run once, by a human, over a direct connection to the target database
-- (SUPABASE_DB_URL — never from the app). Sets the email that
-- app.handle_new_user() grants Owner to on that account's next sign-in.
-- Self-disarming: the setting is cleared automatically once used
-- (docs/BLUEPRINT.md §4.7, docs/DECISIONS.md D-04).
--
-- Usage:
--   psql "$SUPABASE_DB_URL" -v owner_email="'someone@example.com'" -f scripts/bootstrap-owner.sql

insert into public.app_settings (key, value)
values ('owner_bootstrap_email', to_jsonb(:owner_email::text))
on conflict (key) do update set value = excluded.value;
