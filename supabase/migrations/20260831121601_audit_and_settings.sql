-- Phase 1: audit_log and app_settings (docs/BLUEPRINT.md §5.8, §4.6).

create table public.audit_log (
  id bigserial primary key,
  actor_id uuid references public.profiles (id),
  actor_email citext,
  actor_role public.role_enum,
  action text not null,
  entity_type text not null,
  entity_id text,
  before jsonb,
  after jsonb,
  changed_fields text[],
  created_at timestamptz not null default now()
);

create index audit_log_entity_idx on public.audit_log (entity_type, entity_id, created_at desc);
create index audit_log_actor_idx on public.audit_log (actor_id, created_at desc);
create index audit_log_action_idx on public.audit_log (action, created_at desc);

-- Immutable: written only by SECURITY DEFINER functions (app.write_audit(),
-- see the audit_triggers migration). No role — including service_role via
-- PostgREST — may INSERT, UPDATE, or DELETE directly.
revoke insert, update, delete on public.audit_log from authenticated, anon;

create function app.audit_log_immutable()
returns trigger
language plpgsql
as $$
begin
  raise exception 'audit_log is immutable';
end;
$$;

create trigger audit_log_no_update_or_delete
  before update or delete on public.audit_log
  for each row execute function app.audit_log_immutable();

create table public.app_settings (
  key text primary key,
  value jsonb not null,
  updated_by uuid references public.profiles (id),
  updated_at timestamptz not null default now()
);

create trigger set_updated_at
  before update on public.app_settings
  for each row execute function app.set_updated_at();
