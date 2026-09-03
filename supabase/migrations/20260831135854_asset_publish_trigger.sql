-- Phase 3: publish preconditions (docs/BLUEPRINT.md §8), enforced by a
-- BEFORE UPDATE trigger so no code path can bypass them. Runs whenever an
-- asset transitions INTO 'published' (from draft or archived) — not on
-- every subsequent edit of an already-published asset.
--
-- Two of the seven preconditions from §8 aren't checked here because
-- they're already unconditionally guaranteed by column constraints
-- (title non-empty/length, asset_type_id NOT NULL, at least one Drive URL
-- present) — re-checking them would be dead code. Precondition 6
-- (characters require character_profile_id + a pose_action term) is
-- deferred to Phase 5, which is what creates character_profiles.

create function app.is_valid_drive_url(p_url text)
returns boolean
language sql
immutable
as $$
  select p_url ~ '^https://(drive|docs)\.google\.com/';
$$;

create function app.check_asset_publish_preconditions()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_key_stage_count int;
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
  end if;

  return new;
end;
$$;

create trigger check_asset_publish_preconditions
  before update on public.assets
  for each row execute function app.check_asset_publish_preconditions();
