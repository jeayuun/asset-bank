-- Phase 3: asset join tables (docs/BLUEPRINT.md §5.3).

create table public.asset_key_stages (
  asset_id uuid not null references public.assets (id) on delete cascade,
  key_stage_id uuid not null references public.key_stages (id) on delete restrict,
  primary key (asset_id, key_stage_id)
);

create table public.asset_grades (
  asset_id uuid not null references public.assets (id) on delete cascade,
  grade_id uuid not null references public.grades (id) on delete restrict,
  primary key (asset_id, grade_id)
);

create table public.asset_lessons (
  asset_id uuid not null references public.assets (id) on delete cascade,
  lesson_id uuid not null references public.lessons (id) on delete restrict,
  added_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  primary key (asset_id, lesson_id)
);

create table public.asset_taxonomy_terms (
  asset_id uuid not null references public.assets (id) on delete cascade,
  taxonomy_term_id uuid not null references public.taxonomy_terms (id) on delete restrict,
  primary key (asset_id, taxonomy_term_id)
);

create table public.tags (
  id uuid primary key default gen_random_uuid(),
  name citext not null unique,
  created_at timestamptz not null default now()
);

create table public.asset_tags (
  asset_id uuid not null references public.assets (id) on delete cascade,
  tag_id uuid not null references public.tags (id) on delete restrict,
  primary key (asset_id, tag_id)
);
