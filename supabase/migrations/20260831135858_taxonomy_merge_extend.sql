-- Phase 3: extends app.merge_taxonomy_term() to actually reassign
-- asset_taxonomy_terms, now that the table exists (docs/BLUEPRINT.md §5.4
-- "Terms are never deleted... Merging reassigns asset_taxonomy_terms from
-- source to target in one transaction... with a single audit row
-- recording the affected count"). CREATE OR REPLACE keeps the existing
-- grants (docs/DECISIONS.md — same deferral pattern used throughout).

create or replace function app.merge_taxonomy_term(p_source uuid, p_target uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_source_taxonomy uuid;
  v_target_taxonomy uuid;
  v_reassigned_count int;
begin
  if not app.is_super() then
    raise exception 'only a Super Admin may merge taxonomy terms';
  end if;

  if p_source = p_target then
    raise exception 'cannot merge a term into itself';
  end if;

  select taxonomy_id into v_source_taxonomy from public.taxonomy_terms where id = p_source;
  select taxonomy_id into v_target_taxonomy from public.taxonomy_terms where id = p_target;

  if v_source_taxonomy is null or v_target_taxonomy is null then
    raise exception 'source or target term not found';
  end if;

  if v_source_taxonomy is distinct from v_target_taxonomy then
    raise exception 'source and target terms must belong to the same taxonomy';
  end if;

  -- Reassign, skipping any asset that already carries the target term
  -- (would otherwise violate the primary key), then drop the leftover
  -- source rows for assets that already had both.
  update public.asset_taxonomy_terms att
  set taxonomy_term_id = p_target
  where att.taxonomy_term_id = p_source
    and not exists (
      select 1 from public.asset_taxonomy_terms att2
      where att2.asset_id = att.asset_id and att2.taxonomy_term_id = p_target
    );

  get diagnostics v_reassigned_count = row_count;

  delete from public.asset_taxonomy_terms where taxonomy_term_id = p_source;

  update public.taxonomy_terms set is_active = false where id = p_source;

  perform app.write_audit(
    'merge', 'taxonomy_term', p_source::text,
    null,
    jsonb_build_object('merged_into', p_target, 'reassigned_count', v_reassigned_count)
  );
end;
$$;
