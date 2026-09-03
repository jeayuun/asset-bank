-- Phase 1: the invitation gate (docs/BLUEPRINT.md §4.5, docs/DECISIONS.md D-03, D-04).
-- Implemented as an AFTER INSERT trigger on auth.users, not an auth hook,
-- so it needs no plan feature and cannot be disabled by a billing change.

create function app.write_audit(
  p_action text,
  p_entity_type text,
  p_entity_id text default null,
  p_before jsonb default null,
  p_after jsonb default null,
  p_changed_fields text[] default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := auth.uid();
  v_actor_email public.citext;
  v_actor_role public.role_enum;
begin
  select p.email, p.role into v_actor_email, v_actor_role
  from public.profiles p
  where p.id = v_actor_id;

  insert into public.audit_log (
    actor_id, actor_email, actor_role, action, entity_type, entity_id, before, after, changed_fields
  ) values (
    v_actor_id, v_actor_email, v_actor_role, p_action, p_entity_type, p_entity_id, p_before, p_after, p_changed_fields
  );
end;
$$;

-- Internal helper: not exposed to authenticated. Only SECURITY DEFINER
-- functions owned by the migration role call it, which bypasses the grant
-- check entirely (they run as that role, a superuser locally and in
-- Supabase-managed projects).
revoke execute on function app.write_audit(text, text, text, jsonb, jsonb, text[]) from public;

create function app.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_invitation public.invitations%rowtype;
  v_full_name text := coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name');
  v_avatar_url text := coalesce(new.raw_user_meta_data ->> 'avatar_url', new.raw_user_meta_data ->> 'picture');
  v_owner_email text;
  v_owner_exists boolean;
  v_profile_id uuid;
begin
  select i.* into v_invitation
  from public.invitations i
  where lower(i.email::text) = lower(new.email)
    and i.status = 'pending'
    and i.expires_at > now()
  limit 1;

  if found then
    insert into public.profiles (id, email, full_name, avatar_url, role, status, default_key_stage_id, invited_by)
    values (
      new.id, new.email, v_full_name, v_avatar_url,
      v_invitation.role, 'active', v_invitation.default_key_stage_id, v_invitation.invited_by
    )
    returning id into v_profile_id;

    update public.invitations
    set status = 'accepted', accepted_at = now(), accepted_profile_id = v_profile_id
    where id = v_invitation.id;

    -- The profile INSERT and invitation UPDATE are both captured
    -- automatically by app.audit_trigger() (see the audit_triggers
    -- migration) — no manual write_audit() call needed here.
    return new;
  end if;

  select value #>> '{}' into v_owner_email
  from public.app_settings
  where key = 'owner_bootstrap_email';

  select exists (select 1 from public.profiles where is_owner) into v_owner_exists;

  if v_owner_email is not null and lower(v_owner_email) = lower(new.email) and not v_owner_exists then
    insert into public.profiles (id, email, full_name, avatar_url, role, status, is_owner)
    values (new.id, new.email, v_full_name, v_avatar_url, 'super_admin', 'active', true)
    returning id into v_profile_id;

    -- Captured automatically by app.audit_trigger() on the profiles INSERT
    -- and the app_settings DELETE below.
    delete from public.app_settings where key = 'owner_bootstrap_email';

    return new;
  end if;

  -- No match: no profile row is created. The account is denied by every
  -- RLS policy (app.is_active() is false without a profile) and is listed
  -- at /super/users as an unrecognized sign-in attempt.
  perform app.write_audit(
    'sign_in_denied', 'auth_user', new.id::text, null,
    jsonb_build_object('email', new.email)
  );

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function app.handle_new_user();

-- Called by the app right after a successful sign-in (see app/(public)/callback).
-- Scoped to the caller's own row via auth.uid(), so it's safe to expose
-- directly to authenticated.
create function app.log_sign_in()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.profiles set last_sign_in_at = now() where id = auth.uid();
  perform app.write_audit('sign_in', 'profile', auth.uid()::text, null, null);
end;
$$;

revoke execute on function app.log_sign_in() from public;
grant execute on function app.log_sign_in() to authenticated;
