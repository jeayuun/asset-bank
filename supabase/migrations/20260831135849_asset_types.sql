-- Phase 3: asset_types (docs/BLUEPRINT.md §5.3).

create table public.asset_types (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  is_system boolean not null default false,
  allows_video boolean not null default false,
  sort_order int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_updated_at
  before update on public.asset_types
  for each row execute function app.set_updated_at();

-- Slug immutability mirrors the same guardrail on taxonomies
-- (docs/BLUEPRINT.md §5.4) — code elsewhere keys off slug.
create function app.guard_asset_type_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.slug is distinct from old.slug then
    raise exception 'asset_types slugs are immutable';
  end if;

  if old.is_system and new.is_active = false then
    raise exception 'a system asset type cannot be deactivated';
  end if;

  return new;
end;
$$;

create trigger guard_asset_type_update
  before update on public.asset_types
  for each row execute function app.guard_asset_type_update();
