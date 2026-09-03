-- Phase 9: batch import (docs/BLUEPRINT.md §5.8/§10).
--
-- Scope trimmed deliberately to keep this one phase bounded — see
-- docs/PROGRESS.md's Phase 9 entry for the full list. Most relevant here:
-- the assets import kind only carries title/description/asset type/Key
-- Stages/Drive URLs/primary media (no taxonomy terms, lesson assignment,
-- tags, or character-profile linkage via spreadsheet — those stay
-- editable through the existing single-asset edit form once the row
-- lands as a draft); "update existing asset" and "create missing term
-- inline" resolve actions aren't built — a Drive-file-ID duplicate is
-- flagged and skipped by default, an unknown term is a validation error.

create type public.import_kind as enum ('assets', 'characters', 'lessons');
create type public.import_batch_status as enum (
  'uploaded', 'validated', 'committing', 'committed', 'failed'
);
create type public.import_row_status as enum (
  'pending', 'valid', 'invalid', 'duplicate', 'skipped', 'committed', 'failed'
);

create table public.import_batches (
  id uuid primary key default gen_random_uuid(),
  kind public.import_kind not null,
  filename text not null,
  uploaded_by uuid not null references public.profiles (id),
  status public.import_batch_status not null default 'uploaded',
  row_count int not null default 0,
  valid_count int not null default 0,
  error_count int not null default 0,
  committed_at timestamptz,
  options jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_updated_at
  before update on public.import_batches
  for each row execute function app.set_updated_at();

create table public.import_rows (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.import_batches (id) on delete cascade,
  row_number int not null,
  raw jsonb not null,
  normalized jsonb,
  status public.import_row_status not null default 'pending',
  errors jsonb,
  asset_id uuid references public.assets (id),
  created_at timestamptz not null default now(),
  unique (batch_id, row_number)
);

create index import_rows_batch_id_idx on public.import_rows (batch_id);

-- ── app.commit_import_rows(): the one write path for committing rows ──────
-- SECURITY DEFINER so a single call is one atomic transaction per chunk
-- (docs/BLUEPRINT.md §10 step 7: "chunks of 100 rows, one transaction per
-- chunk, progress streamed. Partial failure marks only that chunk") —
-- Supabase's client has no multi-statement transaction primitive, so
-- multi-row/multi-table atomicity has to live in a single plpgsql call,
-- same reasoning as every other multi-step RPC in this schema
-- (app.change_request_status(), app.merge_taxonomy_term(), etc.).
-- Every created row lands as status='draft' (assets) — imports never
-- publish (docs/BLUEPRINT.md §10's hard rules).
create function app.commit_import_rows(p_batch_id uuid, p_row_ids uuid[])
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_kind public.import_kind;
  v_uploaded_by uuid;
  v_row record;
  v_normalized jsonb;
  v_new_asset_id uuid;
begin
  if not app.is_admin() then
    raise exception 'only Admin+ may commit an import';
  end if;

  select kind, uploaded_by into v_kind, v_uploaded_by
  from public.import_batches where id = p_batch_id;

  if v_kind is null then
    raise exception 'no import batch found for %', p_batch_id;
  end if;

  for v_row in
    select id, normalized from public.import_rows
    where id = any(p_row_ids) and batch_id = p_batch_id and status = 'valid'
  loop
    v_normalized := v_row.normalized;

    if v_kind = 'assets' then
      insert into public.assets (
        title, description, asset_type_id, drive_png_url, drive_eps_url, drive_mp4_url,
        drive_png_file_id, drive_eps_file_id, drive_mp4_file_id, primary_media,
        created_by, updated_by
      ) values (
        v_normalized->>'title',
        v_normalized->>'description',
        (v_normalized->>'assetTypeId')::uuid,
        v_normalized->>'drivePngUrl',
        v_normalized->>'driveEpsUrl',
        v_normalized->>'driveMp4Url',
        v_normalized->>'drivePngFileId',
        v_normalized->>'driveEpsFileId',
        v_normalized->>'driveMp4FileId',
        coalesce((v_normalized->>'primaryMedia')::public.media_kind, 'image'),
        v_uploaded_by, v_uploaded_by
      )
      returning id into v_new_asset_id;

      insert into public.asset_key_stages (asset_id, key_stage_id)
      select v_new_asset_id, (value)::uuid
      from jsonb_array_elements_text(coalesce(v_normalized->'keyStageIds', '[]'::jsonb));

      update public.import_rows
      set status = 'committed', asset_id = v_new_asset_id
      where id = v_row.id;

    elsif v_kind = 'characters' then
      -- key_stage_id is deliberately omitted: app.set_character_profile_key_stage()
      -- (a BEFORE INSERT trigger, Phase 5) derives it from grade_id before
      -- the NOT NULL check runs — same "never chosen directly" reasoning
      -- as lesson codes (docs/DECISIONS.md D-09).
      insert into public.character_profiles (
        name, profile_code, grade_id,
        character_type_term_id, gender_term_id, character_group_term_id,
        description, created_by, updated_by
      ) values (
        v_normalized->>'name',
        v_normalized->>'profileCode',
        (v_normalized->>'gradeId')::uuid,
        (v_normalized->>'characterTypeTermId')::uuid,
        (v_normalized->>'genderTermId')::uuid,
        (v_normalized->>'characterGroupTermId')::uuid,
        v_normalized->>'description',
        v_uploaded_by, v_uploaded_by
      );

      update public.import_rows set status = 'committed' where id = v_row.id;

    elsif v_kind = 'lessons' then
      -- code is deliberately omitted: app.set_lesson_code() (Phase 2)
      -- derives it before the NOT NULL check runs (docs/DECISIONS.md D-09).
      insert into public.lessons (grade_id, term_id, lesson_number, title, description)
      values (
        (v_normalized->>'gradeId')::uuid,
        (v_normalized->>'termId')::uuid,
        (v_normalized->>'lessonNumber')::int,
        v_normalized->>'title',
        v_normalized->>'description'
      );

      update public.import_rows set status = 'committed' where id = v_row.id;
    end if;
  end loop;

  update public.import_batches
  set status = 'committing', committed_at = coalesce(committed_at, now())
  where id = p_batch_id;
end;
$$;

revoke execute on function app.commit_import_rows(uuid, uuid[]) from public;
grant execute on function app.commit_import_rows(uuid, uuid[]) to authenticated;

-- ── app.finish_import_batch(): marks the batch done once every chunk has run ──
create function app.finish_import_batch(p_batch_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_failed_count int;
begin
  if not app.is_admin() then
    raise exception 'only Admin+ may finish an import';
  end if;

  select count(*) into v_failed_count
  from public.import_rows
  where batch_id = p_batch_id and status not in ('committed', 'skipped', 'invalid', 'duplicate');

  update public.import_batches
  set status = case when v_failed_count = 0 then 'committed' else 'failed' end::public.import_batch_status,
      committed_at = now()
  where id = p_batch_id;
end;
$$;

revoke execute on function app.finish_import_batch(uuid) from public;
grant execute on function app.finish_import_batch(uuid) to authenticated;

-- ── notification fan-out: notify the uploader once (docs/BLUEPRINT.md §10 step 8) ──
alter type public.notification_type add value 'import_completed';

create function app.notify_import_completed()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status in ('committed', 'failed') and old.status is distinct from new.status then
    perform app.notify(
      new.uploaded_by,
      'import_completed',
      case
        when new.status = 'committed' then 'Import finished: ' || new.filename
        else 'Import finished with errors: ' || new.filename
      end,
      new.valid_count || ' of ' || new.row_count || ' rows imported',
      'import_batch',
      new.id::text,
      '/admin/imports/' || new.id,
      new.uploaded_by
    );
  end if;
  return new;
end;
$$;

create trigger notify_import_completed
  after update on public.import_batches
  for each row execute function app.notify_import_completed();

-- ── RLS (docs/BLUEPRINT.md §4.6: import_batches, import_rows | is_admin() | is_admin() | is_admin() | none) ──
alter table public.import_batches enable row level security;
alter table public.import_batches force row level security;

revoke all on public.import_batches from anon, authenticated;
grant select, insert, update on public.import_batches to authenticated;

create policy import_batches_select on public.import_batches
  for select
  to authenticated
  using ((select app.is_admin()));

create policy import_batches_insert on public.import_batches
  for insert
  to authenticated
  with check ((select app.is_admin()) and uploaded_by = (select app.uid()));

create policy import_batches_update on public.import_batches
  for update
  to authenticated
  using ((select app.is_admin()))
  with check ((select app.is_admin()));

alter table public.import_rows enable row level security;
alter table public.import_rows force row level security;

revoke all on public.import_rows from anon, authenticated;
grant select, insert, update on public.import_rows to authenticated;

create policy import_rows_select on public.import_rows
  for select
  to authenticated
  using ((select app.is_admin()));

create policy import_rows_insert on public.import_rows
  for insert
  to authenticated
  with check ((select app.is_admin()));

create policy import_rows_update on public.import_rows
  for update
  to authenticated
  using ((select app.is_admin()))
  with check ((select app.is_admin()));

-- ── audit ───────────────────────────────────────────────────────────────
-- Only the batch, matching the convention set in Phase 2/3 (the audit
-- trail records the named entity, not its rows) — every committed asset
-- is separately audited already via the existing audit_assets trigger.
create trigger audit_import_batches
  after insert or update or delete on public.import_batches
  for each row execute function app.audit_trigger();
