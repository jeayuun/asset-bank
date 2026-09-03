-- Phase 5: character_profiles (docs/BLUEPRINT.md §5.3, §6).
--
-- Identity is the UUID, not the name (docs/DECISIONS.md D-06): no
-- uniqueness constraint on `name`, so two Grade 1 profiles can both be
-- called "Mia". `profile_code` is an optional admin-assigned handle for
-- when a reliable human-readable identifier is actually needed.
--
-- character_type_term_id / gender_term_id / character_group_term_id are
-- the three character-identity facets that live on the profile itself.
-- profession, wardrobe, and pose_action are per-asset facets (poses are
-- individual asset entries grouped under a profile, §6.2), applied via
-- asset_taxonomy_terms — not columns here.

create table public.character_profiles (
  id uuid primary key default gen_random_uuid(),
  name text not null check (btrim(name) <> ''),
  profile_code text unique,
  grade_id uuid not null references public.grades (id) on delete restrict,
  key_stage_id uuid not null references public.key_stages (id) on delete restrict,
  character_type_term_id uuid references public.taxonomy_terms (id) on delete restrict,
  gender_term_id uuid references public.taxonomy_terms (id) on delete restrict,
  character_group_term_id uuid references public.taxonomy_terms (id) on delete restrict,
  description text,
  cover_asset_id uuid references public.assets (id),
  is_active boolean not null default true,
  created_by uuid references public.profiles (id),
  updated_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_updated_at
  before update on public.character_profiles
  for each row execute function app.set_updated_at();

create index character_profiles_grade_id_idx on public.character_profiles (grade_id);
create index character_profiles_name_trgm_idx on public.character_profiles using gin (name public.gin_trgm_ops);

-- key_stage_id is derived from grade_id, never chosen directly — same
-- "stored code can never drift from its source" reasoning as lesson codes
-- (docs/DECISIONS.md D-09).
create function app.set_character_profile_key_stage()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  select key_stage_id into new.key_stage_id
  from public.grades
  where id = new.grade_id;

  return new;
end;
$$;

create trigger set_character_profile_key_stage
  before insert or update of grade_id on public.character_profiles
  for each row execute function app.set_character_profile_key_stage();

-- assets.character_profile_id is deliberately absent from the Phase 3
-- assets migration — character_profiles didn't exist yet. Added now via
-- alter table, same deferral pattern as taxonomy_asset_types in Phase 3.
alter table public.assets
  add column character_profile_id uuid references public.character_profiles (id) on delete restrict;

create index assets_character_profile_id_idx on public.assets (character_profile_id);

-- ── RLS (docs/BLUEPRINT.md §4.6: character_profiles | is_active() | is_admin() | is_admin() | none) ──
alter table public.character_profiles enable row level security;
alter table public.character_profiles force row level security;

revoke all on public.character_profiles from anon, authenticated;
grant select, insert, update on public.character_profiles to authenticated;

create policy character_profiles_select on public.character_profiles
  for select
  to authenticated
  using ((select app.is_active()));

create policy character_profiles_insert on public.character_profiles
  for insert
  to authenticated
  with check ((select app.is_admin()));

create policy character_profiles_update on public.character_profiles
  for update
  to authenticated
  using ((select app.is_admin()))
  with check ((select app.is_admin()));

create trigger audit_character_profiles
  after insert or update or delete on public.character_profiles
  for each row execute function app.audit_trigger();

-- ── Extend the Phase 3 publish-precondition trigger (docs/BLUEPRINT.md §8) ──
-- Precondition 6, deferred from Phase 3: if asset_type is Characters,
-- character_profile_id must be set and a pose_action term assigned.
create or replace function app.check_asset_publish_preconditions()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_key_stage_count int;
  v_asset_type_slug text;
  v_pose_action_count int;
begin
  if new.status = 'published' and old.status is distinct from 'published' then
    if not (
      (new.drive_png_url is not null and app.is_valid_drive_url(new.drive_png_url))
      or (new.drive_eps_url is not null and app.is_valid_drive_url(new.drive_eps_url))
      or (new.drive_mp4_url is not null and app.is_valid_drive_url(new.drive_mp4_url))
    ) then
      raise exception 'publish precondition failed: no Drive URL passes shape validation';
    end if;

    if new.preview_path is null then
      raise exception 'publish precondition failed: preview_path is required';
    end if;

    select count(*) into v_key_stage_count from public.asset_key_stages where asset_id = new.id;
    if v_key_stage_count = 0 then
      raise exception 'publish precondition failed: at least one Key Stage is required';
    end if;

    if new.primary_media = 'video' and new.drive_mp4_url is null then
      raise exception 'publish precondition failed: primary_media = video requires drive_mp4_url';
    end if;

    select slug into v_asset_type_slug from public.asset_types where id = new.asset_type_id;
    if v_asset_type_slug = 'characters' then
      if new.character_profile_id is null then
        raise exception 'publish precondition failed: character_profile_id is required for Characters assets';
      end if;

      select count(*) into v_pose_action_count
      from public.asset_taxonomy_terms att
      join public.taxonomy_terms tt on tt.id = att.taxonomy_term_id
      join public.taxonomies tx on tx.id = tt.taxonomy_id
      where att.asset_id = new.id and tx.slug = 'pose_action';

      if v_pose_action_count = 0 then
        raise exception 'publish precondition failed: a pose_action term is required for Characters assets';
      end if;
    end if;
  end if;

  return new;
end;
$$;

-- ── Extend search_text to fold in the linked character's name ──
-- Flagged by the Phase 3 migration's own comment as a Phase 5 follow-up:
-- a Viewer searching "Mia" should find her poses even when the pose title
-- itself doesn't repeat the character's name.
create or replace function app.set_asset_search_text()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_character_name text;
begin
  if new.character_profile_id is not null then
    select name into v_character_name from public.character_profiles where id = new.character_profile_id;
  end if;

  new.search_text := trim(both ' ' from
    coalesce(new.title, '') || ' ' || coalesce(new.description, '') || ' ' || coalesce(v_character_name, '')
  );
  return new;
end;
$$;
