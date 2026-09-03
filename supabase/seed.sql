-- Phase 1: KS1-3, Grades 1-8, and a local development Owner.

insert into public.key_stages (code, name, sort_order)
values
  ('KS1', 'Key Stage 1', 1),
  ('KS2', 'Key Stage 2', 2),
  ('KS3', 'Key Stage 3', 3);

insert into public.grades (key_stage_id, number, label, sort_order)
select
  ks.id,
  g.number,
  'Grade ' || g.number,
  g.number
from (values (1), (2), (3), (4), (5), (6), (7), (8)) as g (number)
join public.key_stages ks on ks.code = case
  when g.number between 1 and 3 then 'KS1'
  when g.number between 4 and 6 then 'KS2'
  else 'KS3'
end;

-- Local development Owner, seeded through the real bootstrap code path
-- (app.handle_new_user(), see the handle_new_user migration) rather than a
-- direct profiles insert, so seeding also exercises that trigger.
insert into public.app_settings (key, value)
values ('owner_bootstrap_email', to_jsonb('owner@localhost.dev'::text));

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at
) values (
  '00000000-0000-0000-0000-000000000000',
  '00000000-0000-0000-0000-000000000001',
  'authenticated', 'authenticated',
  'owner@localhost.dev',
  crypt('local-dev-only', gen_salt('bf')),
  now(),
  '{"provider":"google","providers":["google"]}',
  '{"full_name":"Local Dev Owner"}',
  now(), now()
);

-- Phase 2: Terms 1-3 and the seeded system taxonomies
-- (docs/BLUEPRINT.md §5.4). Only Gender's terms are seeded — its set is
-- fixed and closed by the product spec. The rest start empty; the
-- Blueprint's character-type list is explicitly "examples," not a
-- required seed list, and a Super Admin adds real terms through
-- /super/taxonomy.

insert into public.terms (number, label)
values
  (1, 'Term 1'),
  (2, 'Term 2'),
  (3, 'Term 3');

insert into public.taxonomies (slug, name, description, is_multi, is_hierarchical, is_system, is_closed, sort_order)
values
  ('character_group', 'Character group', null, false, false, true, false, 1),
  ('character_type', 'Character type', null, false, false, true, false, 2),
  ('profession', 'Profession', 'Two levels: profession groups, then professions within a group.', false, true, true, false, 3),
  ('wardrobe', 'Wardrobe or uniform', null, true, false, true, false, 4),
  ('pose_action', 'Pose or action', null, false, false, true, false, 5),
  ('gender', 'Gender', null, false, false, true, true, 6),
  ('math_tool_kind', 'Math tool kind', null, true, false, true, false, 7),
  ('timer_style', 'Timer style', null, true, false, true, false, 8);

insert into public.taxonomy_terms (taxonomy_id, name, slug, sort_order)
select t.id, v.name, v.slug, v.sort_order
from public.taxonomies t
join (values ('Female', 'female', 1), ('Male', 'male', 2)) as v (name, slug, sort_order)
  on true
where t.slug = 'gender';

-- Phase 3: seeded asset types and their taxonomy mappings
-- (docs/BLUEPRINT.md §5.3, §5.4).

insert into public.asset_types (slug, name, is_system, allows_video, sort_order)
values
  ('characters', 'Characters', true, true, 1),
  ('objects-and-backgrounds', 'Objects and backgrounds', true, true, 2),
  ('math-tools', 'Math tools', true, true, 3),
  ('timers', 'Timers', true, true, 4),
  ('template-tools', 'Template tools', true, true, 5);

insert into public.taxonomy_asset_types (taxonomy_id, asset_type_id)
select t.id, at.id
from public.taxonomies t
join public.asset_types at on (
  (t.slug in ('character_group', 'character_type', 'profession', 'wardrobe', 'pose_action', 'gender')
    and at.slug = 'characters')
  or (t.slug = 'math_tool_kind' and at.slug = 'math-tools')
  or (t.slug = 'timer_style' and at.slug = 'timers')
);
