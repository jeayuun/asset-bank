-- Phase 1: enums (docs/BLUEPRINT.md §13, §5.1).

create type public.role_enum as enum ('viewer', 'admin', 'super_admin');
create type public.profile_status as enum ('active', 'suspended');
create type public.invitation_status as enum ('pending', 'accepted', 'revoked', 'expired');
