-- Phase 1: profiles — the sole authorization authority (docs/DECISIONS.md D-01, D-04).
-- Created only by app.handle_new_user() (see the handle_new_user migration), never directly.

-- Schema pinned explicitly so every SECURITY DEFINER function (which sets
-- search_path = '') can reference public.citext unambiguously.
create extension if not exists citext with schema public;

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email citext not null unique,
  full_name text,
  avatar_url text,
  role public.role_enum not null default 'viewer',
  status public.profile_status not null default 'active',
  is_owner boolean not null default false,
  default_key_stage_id uuid references public.key_stages (id),
  invited_by uuid references public.profiles (id),
  last_sign_in_at timestamptz,
  suspended_at timestamptz,
  suspended_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_updated_at
  before update on public.profiles
  for each row execute function app.set_updated_at();

-- At most one Owner. Exactly one is asserted by scripts/check-owner.ts,
-- not by the database (docs/DECISIONS.md D-04).
create unique index profiles_single_owner
  on public.profiles (is_owner)
  where is_owner;
