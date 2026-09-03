-- Phase 1: protected RPCs (docs/BLUEPRINT.md §4.6 "Column-level protection", §4.7).
-- role, status, and is_owner are excluded from profiles' authenticated
-- UPDATE grant (rls_policies migration) — these are the only route to
-- changing them, short of a direct database connection.

create function app.set_user_role(p_target uuid, p_role public.role_enum)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_target_is_owner boolean;
begin
  if not app.is_super() then
    raise exception 'only a Super Admin may change roles';
  end if;

  if p_role not in ('viewer', 'admin') then
    raise exception 'this RPC only assigns viewer or admin — super_admin requires app.grant_super_admin() over a direct connection';
  end if;

  select is_owner into v_target_is_owner from public.profiles where id = p_target;

  if v_target_is_owner is null then
    raise exception 'no profile found for %', p_target;
  end if;

  if v_target_is_owner then
    raise exception 'the Owner role cannot be changed';
  end if;

  update public.profiles set role = p_role where id = p_target;
end;
$$;

revoke execute on function app.set_user_role(uuid, public.role_enum) from public;
grant execute on function app.set_user_role(uuid, public.role_enum) to authenticated;

create function app.suspend_user(p_target uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_target_is_owner boolean;
begin
  if not app.is_super() then
    raise exception 'only a Super Admin may suspend a user';
  end if;

  select is_owner into v_target_is_owner from public.profiles where id = p_target;

  if v_target_is_owner is null then
    raise exception 'no profile found for %', p_target;
  end if;

  if v_target_is_owner then
    raise exception 'the Owner cannot be suspended';
  end if;

  update public.profiles
  set status = 'suspended', suspended_at = now(), suspended_by = auth.uid()
  where id = p_target;
end;
$$;

revoke execute on function app.suspend_user(uuid) from public;
grant execute on function app.suspend_user(uuid) to authenticated;

-- Session revocation (auth.admin.signOut over the admin API) happens in the
-- Server Action that calls this RPC, not here — SQL alone cannot revoke a
-- Supabase Auth refresh token (§4.4).

create function app.reactivate_user(p_target uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not app.is_super() then
    raise exception 'only a Super Admin may reactivate a user';
  end if;

  update public.profiles
  set status = 'active', suspended_at = null, suspended_by = null
  where id = p_target;

  if not found then
    raise exception 'no profile found for %', p_target;
  end if;
end;
$$;

revoke execute on function app.reactivate_user(uuid) from public;
grant execute on function app.reactivate_user(uuid) to authenticated;

-- The only route to Super Admin. EXECUTE is revoked from anon and
-- authenticated so PostgREST cannot reach it — it is invoked only over a
-- direct database connection (docs/DECISIONS.md D-04).
create function app.grant_super_admin(p_target uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform set_config('app.allow_super_admin_grant', 'on', true);

  update public.profiles set role = 'super_admin' where id = p_target;

  if not found then
    raise exception 'no profile found for %', p_target;
  end if;
end;
$$;

revoke execute on function app.grant_super_admin(uuid) from public, anon, authenticated;

-- /super/users lists these as "unrecognized sign-in attempts"
-- (docs/BLUEPRINT.md §4.5). auth.users isn't reachable through PostgREST
-- directly, so this is the read path for it.
create function app.unrecognized_sign_ins()
returns table (id uuid, email text, created_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not app.is_super() then
    raise exception 'only a Super Admin may view unrecognized sign-in attempts';
  end if;

  return query
    select u.id, u.email::text, u.created_at
    from auth.users u
    left join public.profiles p on p.id = u.id
    where p.id is null
    order by u.created_at desc;
end;
$$;

revoke execute on function app.unrecognized_sign_ins() from public;
grant execute on function app.unrecognized_sign_ins() to authenticated;
