-- Phase 1: app schema + key_stages/grades (docs/BLUEPRINT.md §5.2, §13).
-- key_stages and grades land here, ahead of curriculum's own Phase 2 tables,
-- because profiles.default_key_stage_id needs key_stages to exist.

create schema if not exists app;

-- USAGE on a non-public schema is not granted by default. This is
-- distinct from (and in addition to) the per-function EXECUTE grants
-- elsewhere: EXECUTE alone is enough for a role to be evaluated inside an
-- already-compiled RLS policy (the table owner resolved those names once,
-- at CREATE POLICY time), but any *fresh* query that references
-- `app.something` — which is exactly what every PostgREST RPC call is —
-- has to resolve that name itself, and name resolution needs USAGE.
-- Without this grant, `supabase.rpc(...)` calls from authenticated users
-- fail with "permission denied for schema app" even though the specific
-- function has EXECUTE granted.
grant usage on schema app to authenticated;

-- Shared updated_at maintenance for every table that carries the column.
create function app.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create table public.key_stages (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code in ('KS1', 'KS2', 'KS3')),
  name text not null,
  sort_order int not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_updated_at
  before update on public.key_stages
  for each row execute function app.set_updated_at();

create table public.grades (
  id uuid primary key default gen_random_uuid(),
  key_stage_id uuid not null references public.key_stages (id) on delete restrict,
  number int not null unique check (number between 1 and 8),
  label text not null,
  sort_order int not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_updated_at
  before update on public.grades
  for each row execute function app.set_updated_at();
