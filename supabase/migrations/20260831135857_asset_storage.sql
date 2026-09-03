-- Phase 3: the asset-previews Storage bucket (docs/BLUEPRINT.md §7).
-- Private, 5MB per object, image previews only. Uploaded static previews
-- only — never original assets (CLAUDE.md §6).

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('asset-previews', 'asset-previews', false, 5242880, array['image/png', 'image/jpeg', 'image/webp']);

create policy asset_previews_select on storage.objects
  for select
  to authenticated
  using (bucket_id = 'asset-previews' and (select app.is_active()));

create policy asset_previews_insert on storage.objects
  for insert
  to authenticated
  with check (bucket_id = 'asset-previews' and (select app.is_admin()));

create policy asset_previews_update on storage.objects
  for update
  to authenticated
  using (bucket_id = 'asset-previews' and (select app.is_admin()))
  with check (bucket_id = 'asset-previews' and (select app.is_admin()));

create policy asset_previews_delete on storage.objects
  for delete
  to authenticated
  using (bucket_id = 'asset-previews' and (select app.is_admin()));
