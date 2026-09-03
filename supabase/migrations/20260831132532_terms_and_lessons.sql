-- Phase 2: terms + lessons (docs/BLUEPRINT.md §5.2, docs/DECISIONS.md D-09).

create table public.terms (
  id uuid primary key default gen_random_uuid(),
  number int not null unique check (number between 1 and 3),
  label text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_updated_at
  before update on public.terms
  for each row execute function app.set_updated_at();

create table public.lessons (
  id uuid primary key default gen_random_uuid(),
  grade_id uuid not null references public.grades (id) on delete restrict,
  term_id uuid not null references public.terms (id) on delete restrict,
  lesson_number int not null check (lesson_number between 1 and 99),
  code text not null,
  title text not null check (btrim(title) <> ''),
  description text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (grade_id, term_id, lesson_number),
  unique (code)
);

create trigger set_updated_at
  before update on public.lessons
  for each row execute function app.set_updated_at();

-- code is trigger-derived and always overwritten, so a hand-edited value
-- can never persist (docs/DECISIONS.md D-09). Format: M<grade>T<term>L<NN>,
-- e.g. M3T2L07.
create function app.set_lesson_code()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_grade_number int;
  v_term_number int;
begin
  select number into v_grade_number from public.grades where id = new.grade_id;
  select number into v_term_number from public.terms where id = new.term_id;

  if v_grade_number is null then
    raise exception 'unknown grade_id %', new.grade_id;
  end if;
  if v_term_number is null then
    raise exception 'unknown term_id %', new.term_id;
  end if;

  new.code := 'M' || v_grade_number || 'T' || v_term_number || 'L' || lpad(new.lesson_number::text, 2, '0');
  return new;
end;
$$;

create trigger set_lesson_code
  before insert or update on public.lessons
  for each row execute function app.set_lesson_code();

-- A stored lesson code can never drift from its source: block changing
-- grades.number / terms.number while any lesson still references the row.
create function app.guard_curriculum_number_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.number is distinct from old.number then
    if tg_table_name = 'grades' and exists (select 1 from public.lessons where grade_id = old.id) then
      raise exception 'cannot change grades.number while lessons reference this grade';
    end if;
    if tg_table_name = 'terms' and exists (select 1 from public.lessons where term_id = old.id) then
      raise exception 'cannot change terms.number while lessons reference this term';
    end if;
  end if;
  return new;
end;
$$;

create trigger guard_number_change
  before update on public.grades
  for each row execute function app.guard_curriculum_number_change();

create trigger guard_number_change
  before update on public.terms
  for each row execute function app.guard_curriculum_number_change();
