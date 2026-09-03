-- Phase 1: app.* authorization helpers (docs/BLUEPRINT.md §4.2, docs/DECISIONS.md D-01, D-02).
--
-- SECURITY DEFINER is what lets these read public.profiles without
-- re-triggering profiles' own RLS policies and recursing. That is exactly
-- why public.profiles must stay exempt from FORCE ROW LEVEL SECURITY
-- (enforced in the rls_policies migration) — see docs/DECISIONS.md D-02.

create function app.uid()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select auth.uid();
$$;

revoke execute on function app.uid() from public;
grant execute on function app.uid() to authenticated;

create type app.profile_info as (
  role public.role_enum,
  status public.profile_status
);

create function app.profile()
returns app.profile_info
language sql
stable
security definer
set search_path = ''
as $$
  select p.role, p.status
  from public.profiles p
  where p.id = auth.uid();
$$;

revoke execute on function app.profile() from public;
grant execute on function app.profile() to authenticated;

create function app.is_active()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid() and p.status = 'active'
  );
$$;

revoke execute on function app.is_active() from public;
grant execute on function app.is_active() to authenticated;

create function app.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.status = 'active'
      and p.role in ('admin', 'super_admin')
  );
$$;

revoke execute on function app.is_admin() from public;
grant execute on function app.is_admin() to authenticated;

create function app.is_super()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.status = 'active'
      and p.role = 'super_admin'
  );
$$;

revoke execute on function app.is_super() from public;
grant execute on function app.is_super() to authenticated;
