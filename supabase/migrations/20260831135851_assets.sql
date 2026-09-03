-- Phase 3: assets (docs/BLUEPRINT.md §5.3).
--
-- character_profile_id is deliberately absent — character_profiles is
-- Phase 5's table (§11: "Characters, poses, and lesson assignment"). It
-- and the publish precondition "characters requires character_profile_id
-- and a pose_action term" land in a Phase 5 migration via
-- `alter table` + `create or replace function`. Nothing stops creating an
-- asset with asset_type = 'characters' in the interim; that gap closes in
-- Phase 5, same deferral pattern as Phase 2's taxonomy_asset_types.

create extension if not exists pg_trgm with schema public;

create type public.asset_status as enum ('draft', 'published', 'archived');
create type public.review_state as enum ('none', 'ready_for_review', 'changes_requested');
create type public.media_kind as enum ('image', 'video');

create table public.assets (
  id uuid primary key default gen_random_uuid(),
  title text not null check (btrim(title) <> '' and length(title) <= 160),
  description text,
  asset_type_id uuid not null references public.asset_types (id) on delete restrict,
  status public.asset_status not null default 'draft',
  review_state public.review_state not null default 'none',
  preview_path text,
  preview_thumb_path text,
  preview_width int,
  preview_height int,
  preview_bytes int,
  drive_png_url text,
  drive_eps_url text,
  drive_mp4_url text,
  drive_png_file_id text,
  drive_eps_file_id text,
  drive_mp4_file_id text,
  primary_media public.media_kind not null default 'image',
  search_text text,
  search_tsv tsvector generated always as (to_tsvector('english', coalesce(search_text, ''))) stored,
  created_by uuid references public.profiles (id),
  updated_by uuid references public.profiles (id),
  published_at timestamptz,
  published_by uuid references public.profiles (id),
  archived_at timestamptz,
  archived_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (coalesce(drive_png_url, drive_eps_url, drive_mp4_url) is not null)
);

create trigger set_updated_at
  before update on public.assets
  for each row execute function app.set_updated_at();

create index assets_search_tsv_idx on public.assets using gin (search_tsv);
create index assets_title_trgm_idx on public.assets using gin (title public.gin_trgm_ops);
create index assets_status_type_idx on public.assets (status, asset_type_id);

-- Keeps search_text (and therefore search_tsv) in sync with the fields a
-- Viewer actually searches by. Extended in later phases as more
-- search-relevant fields (tags, character name, taxonomy terms) exist.
create function app.set_asset_search_text()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.search_text := trim(both ' ' from coalesce(new.title, '') || ' ' || coalesce(new.description, ''));
  return new;
end;
$$;

create trigger set_asset_search_text
  before insert or update on public.assets
  for each row execute function app.set_asset_search_text();
