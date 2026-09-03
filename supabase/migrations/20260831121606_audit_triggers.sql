-- Phase 1: generic row-change auditing (docs/BLUEPRINT.md §5.8).
-- Fires regardless of code path, including direct SQL. Complements
-- app.write_audit(), which the app layer and app.handle_new_user() call
-- directly for events with no row change (e.g. sign_in_denied).

create function app.audit_trigger()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_entity_id text;
  v_before jsonb;
  v_after jsonb;
  v_changed text[];
begin
  if tg_op = 'DELETE' then
    v_before := to_jsonb(old);
    v_after := null;
    v_entity_id := coalesce(v_before ->> 'id', v_before ->> 'key');
  elsif tg_op = 'INSERT' then
    v_before := null;
    v_after := to_jsonb(new);
    v_entity_id := coalesce(v_after ->> 'id', v_after ->> 'key');
  else
    v_before := to_jsonb(old);
    v_after := to_jsonb(new);
    v_entity_id := coalesce(v_after ->> 'id', v_after ->> 'key');

    select array_agg(k) into v_changed
    from jsonb_object_keys(v_after) as k
    where v_after -> k is distinct from v_before -> k;
  end if;

  perform app.write_audit(lower(tg_op), tg_table_name::text, v_entity_id, v_before, v_after, v_changed);

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

create trigger audit_profiles
  after insert or update or delete on public.profiles
  for each row execute function app.audit_trigger();

create trigger audit_invitations
  after insert or update or delete on public.invitations
  for each row execute function app.audit_trigger();

create trigger audit_app_settings
  after insert or update or delete on public.app_settings
  for each row execute function app.audit_trigger();
