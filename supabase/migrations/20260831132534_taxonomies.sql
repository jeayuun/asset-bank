-- Phase 2: taxonomies + taxonomy_terms (docs/BLUEPRINT.md §5.4).
--
-- taxonomy_asset_types (which taxonomies apply to which asset types) is
-- deliberately NOT created here — it has a NOT NULL FK to asset_types,
-- which doesn't exist until Phase 3 (§5.3). Adding it now would mean
-- either a dangling/nullable FK that contradicts the Blueprint's own
-- reasoning for the table ("real foreign keys, so an asset type can never
-- be referenced by a slug that does not exist") or pulling Phase 3 scope
-- forward. It lands in a Phase 3 migration instead.

create table public.taxonomies (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  description text,
  is_multi boolean not null,
  is_hierarchical boolean not null,
  is_system boolean not null default false,
  is_closed boolean not null default false,
  sort_order int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_updated_at
  before update on public.taxonomies
  for each row execute function app.set_updated_at();

-- Slugs are immutable after creation (docs/BLUEPRINT.md §5.4 "Taxonomy
-- guardrails") — renames change `name` only, so code keyed on slug never
-- breaks. is_system taxonomies additionally can never be deactivated.
create function app.guard_taxonomy_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.slug is distinct from old.slug then
    raise exception 'taxonomy slugs are immutable';
  end if;

  if old.is_system and new.is_active = false then
    raise exception 'a system taxonomy cannot be deactivated';
  end if;

  return new;
end;
$$;

create trigger guard_taxonomy_update
  before update on public.taxonomies
  for each row execute function app.guard_taxonomy_update();

create table public.taxonomy_terms (
  id uuid primary key default gen_random_uuid(),
  taxonomy_id uuid not null references public.taxonomies (id) on delete restrict,
  parent_id uuid references public.taxonomy_terms (id) on delete restrict,
  name text not null check (btrim(name) <> ''),
  slug text not null,
  sort_order int not null default 0,
  is_active boolean not null default true,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (taxonomy_id, slug)
);

create trigger set_updated_at
  before update on public.taxonomy_terms
  for each row execute function app.set_updated_at();

-- A term may only have a parent if its taxonomy is hierarchical, the
-- parent belongs to the same taxonomy, and the parent is itself a
-- top-level term — hierarchy is capped at two levels (docs/BLUEPRINT.md
-- §5.4 "Profession model", generalized to every hierarchical taxonomy).
create function app.guard_taxonomy_term_hierarchy()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_is_hierarchical boolean;
  v_parent_taxonomy_id uuid;
  v_parent_has_parent boolean;
begin
  if new.parent_id is null then
    return new;
  end if;

  if new.parent_id = new.id then
    raise exception 'a taxonomy term cannot be its own parent';
  end if;

  select is_hierarchical into v_is_hierarchical from public.taxonomies where id = new.taxonomy_id;
  if not coalesce(v_is_hierarchical, false) then
    raise exception 'this taxonomy is not hierarchical; parent_id must be null';
  end if;

  select taxonomy_id, parent_id is not null into v_parent_taxonomy_id, v_parent_has_parent
  from public.taxonomy_terms
  where id = new.parent_id;

  if v_parent_taxonomy_id is distinct from new.taxonomy_id then
    raise exception 'a parent term must belong to the same taxonomy';
  end if;

  if v_parent_has_parent then
    raise exception 'taxonomy term hierarchy is capped at two levels';
  end if;

  return new;
end;
$$;

create trigger guard_taxonomy_term_hierarchy
  before insert or update on public.taxonomy_terms
  for each row execute function app.guard_taxonomy_term_hierarchy();
