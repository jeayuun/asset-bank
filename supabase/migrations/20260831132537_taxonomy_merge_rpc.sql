-- Phase 2: taxonomy term merge (docs/BLUEPRINT.md §5.4 "Taxonomy guardrails").
-- "Merging reassigns asset_taxonomy_terms from source to target ... and
-- deactivates the source." No table references taxonomy_terms yet
-- (asset_taxonomy_terms is Phase 3), so there is nothing to reassign —
-- this deactivates the source and records the merge. The reassignment
-- step is added once asset_taxonomy_terms exists, via CREATE OR REPLACE
-- in a Phase 3 migration.

create function app.merge_taxonomy_term(p_source uuid, p_target uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_source_taxonomy uuid;
  v_target_taxonomy uuid;
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

  update public.taxonomy_terms set is_active = false where id = p_source;

  perform app.write_audit(
    'merge', 'taxonomy_term', p_source::text,
    null,
    jsonb_build_object('merged_into', p_target)
  );
end;
$$;

revoke execute on function app.merge_taxonomy_term(uuid, uuid) from public;
grant execute on function app.merge_taxonomy_term(uuid, uuid) to authenticated;
