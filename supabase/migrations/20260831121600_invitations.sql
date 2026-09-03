-- Phase 1: invitations (docs/BLUEPRINT.md §5.1, §4.7 / D-04 guarantee).

create table public.invitations (
  id uuid primary key default gen_random_uuid(),
  email citext not null,
  role public.role_enum not null check (role <> 'super_admin'),
  default_key_stage_id uuid references public.key_stages (id),
  invited_by uuid not null references public.profiles (id),
  status public.invitation_status not null default 'pending',
  expires_at timestamptz not null,
  accepted_at timestamptz,
  accepted_profile_id uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_updated_at
  before update on public.invitations
  for each row execute function app.set_updated_at();

-- Only one pending invitation per email at a time.
create unique index invitations_one_pending_per_email
  on public.invitations (lower(email::text))
  where status = 'pending';
