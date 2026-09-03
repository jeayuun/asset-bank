-- Phase 3: taxonomy_asset_types (docs/BLUEPRINT.md §5.4). Deferred from
-- Phase 2 because it has a NOT NULL FK to asset_types, which didn't exist
-- yet — see the Phase 2 taxonomies migration's comment.

create table public.taxonomy_asset_types (
  taxonomy_id uuid not null references public.taxonomies (id) on delete restrict,
  asset_type_id uuid not null references public.asset_types (id) on delete restrict,
  primary key (taxonomy_id, asset_type_id)
);
