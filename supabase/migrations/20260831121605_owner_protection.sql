-- Phase 1: Owner protection (docs/BLUEPRINT.md §4.7, docs/DECISIONS.md D-04).
-- Together with the partial unique index in the profiles migration and the
-- invitations.role CHECK, this is what makes the Owner guarantee hold
-- regardless of code path — UI, Server Action, RPC, or a leaked
-- service-role key.

create function app.protect_owner()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    if old.is_owner then
      raise exception 'the Owner profile cannot be deleted';
    end if;
    return old;
  end if;

  if old.is_owner and (
    new.role is distinct from old.role
    or new.status is distinct from old.status
    or new.is_owner is distinct from old.is_owner
  ) then
    raise exception 'the Owner profile cannot be demoted, suspended, or have is_owner changed';
  end if;

  return new;
end;
$$;

create trigger protect_owner
  before update or delete on public.profiles
  for each row execute function app.protect_owner();

-- A role change to super_admin (not the initial Owner-bootstrap INSERT,
-- which sets it at creation — see the handle_new_user migration) requires
-- the transaction-local flag that only app.grant_super_admin() sets (see
-- the admin_rpcs migration).
create function app.guard_super_admin_grant()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.role = 'super_admin' and old.role is distinct from new.role then
    if current_setting('app.allow_super_admin_grant', true) is distinct from 'on' then
      raise exception 'role cannot be changed to super_admin outside app.grant_super_admin()';
    end if;
  end if;

  return new;
end;
$$;

create trigger guard_super_admin_grant
  before update on public.profiles
  for each row execute function app.guard_super_admin_grant();
