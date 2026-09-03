-- Phase 8: notifications (docs/BLUEPRINT.md §5.7, docs/DECISIONS.md D-12).
--
-- No explicit "event catalogue" is defined anywhere in the docs — this
-- migration derives one from what's actually notification-worthy in the
-- app so far: the three watcher/assignee-facing moments in the request
-- workflow (Phase 7), the only multi-actor feature built to date.
-- notification_type is additive, so later phases (e.g. Phase 9's "notify
-- the uploader" for batch import) can add values without disruption.

create type public.notification_type as enum (
  'request_status_changed',
  'request_assigned',
  'request_comment'
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references public.profiles (id) on delete cascade,
  type public.notification_type not null,
  title text not null,
  body text,
  entity_type text not null,
  entity_id text,
  url text,
  actor_id uuid references public.profiles (id),
  -- Not in the Blueprint's literal schema — added to satisfy D-12's
  -- explicit "a failure is logged to audit_log and surfaced in the UI as
  -- 'notification email failed'" requirement, which the bare schema
  -- can't do on its own. 'not_needed' covers both "email preference is
  -- off" and "in-app only, no email attempted."
  email_status text not null default 'not_needed'
    check (email_status in ('not_needed', 'pending', 'sent', 'failed')),
  email_error text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index notifications_recipient_unread_idx
  on public.notifications (recipient_id, created_at desc)
  where read_at is null;

create table public.notification_preferences (
  profile_id uuid not null references public.profiles (id) on delete cascade,
  type public.notification_type not null,
  in_app boolean not null default true,
  email boolean not null default true,
  primary key (profile_id, type)
);

-- ── app.notify(): the single write path for every notification row ────────
-- SECURITY DEFINER so it's callable from trigger functions regardless of
-- the invoking role — matches app.write_audit()'s "internal helper, not
-- exposed to authenticated" pattern below. Respects in_app preference by
-- skipping row creation entirely when it's off (an absent
-- notification_preferences row defaults both booleans to true — an
-- opt-out model, not opt-in). email_status starts 'pending' only when
-- the email preference is also on; the actual send happens from the
-- Node/Server Action layer, which Postgres can't reach.
create function app.notify(
  p_recipient_id uuid,
  p_type public.notification_type,
  p_title text,
  p_body text,
  p_entity_type text,
  p_entity_id text,
  p_url text,
  p_actor_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_in_app boolean;
  v_email boolean;
  v_notification_id uuid;
begin
  select np.in_app, np.email into v_in_app, v_email
  from public.notification_preferences np
  where np.profile_id = p_recipient_id and np.type = p_type;

  v_in_app := coalesce(v_in_app, true);
  v_email := coalesce(v_email, true);

  if not v_in_app then
    return null;
  end if;

  insert into public.notifications (
    recipient_id, type, title, body, entity_type, entity_id, url, actor_id, email_status
  ) values (
    p_recipient_id, p_type, p_title, p_body, p_entity_type, p_entity_id, p_url, p_actor_id,
    case when v_email then 'pending' else 'not_needed' end
  )
  returning id into v_notification_id;

  return v_notification_id;
end;
$$;

revoke execute on function app.notify(
  uuid, public.notification_type, text, text, text, text, text, uuid
) from public;
-- Not granted to authenticated either — same "internal helper" reasoning
-- as app.write_audit(). Only called from within other SECURITY DEFINER
-- functions (the triggers below), which bypasses the grant check by
-- running as the owning role.

-- ── Trigger fan-out: the three event types ─────────────────────────────
create function app.notify_request_status_changed()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_watcher record;
begin
  if new.status is distinct from old.status then
    for v_watcher in
      select profile_id from public.request_watchers
      where request_id = new.id and profile_id is distinct from auth.uid()
    loop
      perform app.notify(
        v_watcher.profile_id,
        'request_status_changed',
        'Request ' || new.reference || ' is now ' || new.status,
        new.title,
        'asset_request',
        new.id::text,
        '/requests/' || new.id,
        auth.uid()
      );
    end loop;
  end if;
  return new;
end;
$$;

create trigger notify_request_status_changed
  after update on public.asset_requests
  for each row execute function app.notify_request_status_changed();

create function app.notify_request_assigned()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.assigned_to is not null and new.assigned_to is distinct from old.assigned_to then
    perform app.notify(
      new.assigned_to,
      'request_assigned',
      'You were assigned to ' || new.reference,
      new.title,
      'asset_request',
      new.id::text,
      '/requests/' || new.id,
      auth.uid()
    );
  end if;
  return new;
end;
$$;

create trigger notify_request_assigned
  after update on public.asset_requests
  for each row execute function app.notify_request_assigned();

create function app.notify_request_comment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_watcher record;
  v_request_title text;
  v_request_reference text;
begin
  select title, reference into v_request_title, v_request_reference
  from public.asset_requests where id = new.request_id;

  for v_watcher in
    select profile_id from public.request_watchers
    where request_id = new.request_id and profile_id is distinct from new.author_id
  loop
    perform app.notify(
      v_watcher.profile_id,
      'request_comment',
      'New comment on ' || v_request_reference,
      new.body,
      'request_comment',
      new.id::text,
      '/requests/' || new.request_id,
      new.author_id
    );
  end loop;
  return new;
end;
$$;

create trigger notify_request_comment
  after insert on public.request_comments
  for each row execute function app.notify_request_comment();

-- ── Email delivery support, callable from the Server Action layer ──────
-- Two RLS problems in one, both requiring SECURITY DEFINER:
--
-- 1. `notifications` SELECT is `recipient_id = uid()` (correct — a user
--    should only ever read their own notifications directly). But the
--    Server Action calling this runs as the *actor* (whoever changed the
--    status, commented, etc.), not the *recipient* (a watcher or the
--    assignee) — those are almost always different people. A plain
--    RLS-scoped query from the actor's session would see zero of the
--    rows it just caused the trigger to create, so email would never
--    fire for anyone but the actor notifying themselves. This has to be
--    SECURITY DEFINER to find them at all.
-- 2. Same "profiles RLS blocks reading a stranger's email" gap hit twice
--    already in Phase 6/7.
--
-- Scoped narrowly regardless: the caller must already have legitimate
-- access to (entity_type, entity_id) — every event that creates a
-- notification originates from an action the caller could only take
-- after already passing app.can_see_request() for that same request —
-- and only rows still 'pending' within the given window are returned.
create function app.pending_notification_emails_for_entity(
  p_entity_type text,
  p_entity_id text,
  p_since timestamptz
)
returns table (id uuid, recipient_email public.citext, title text, body text, url text)
language sql
stable
security definer
set search_path = ''
as $$
  select n.id, p.email, n.title, n.body, n.url
  from public.notifications n
  join public.profiles p on p.id = n.recipient_id
  where n.entity_type = p_entity_type
    and n.entity_id = p_entity_id
    and n.email_status = 'pending'
    and n.created_at >= p_since;
$$;

revoke execute on function app.pending_notification_emails_for_entity(text, text, timestamptz) from public;
grant execute on function app.pending_notification_emails_for_entity(text, text, timestamptz) to authenticated;

-- email_status/email_error are outside notifications' authenticated
-- UPDATE grant (read_at only, below) — this is the only path that
-- records a send result, and the only path that writes the D-12-required
-- audit row on failure.
create function app.record_notification_email_result(
  p_notification_id uuid,
  p_success boolean,
  p_error text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.notifications
  set
    email_status = case when p_success then 'sent' else 'failed' end,
    email_error = case when p_success then null else p_error end
  where id = p_notification_id;

  if not p_success then
    perform app.write_audit(
      'notification_email_failed', 'notification', p_notification_id::text,
      null, jsonb_build_object('error', p_error), null
    );
  end if;
end;
$$;

revoke execute on function app.record_notification_email_result(uuid, boolean, text) from public;
grant execute on function app.record_notification_email_result(uuid, boolean, text) to authenticated;

-- ── RLS (docs/BLUEPRINT.md §4.6) ──────────────────────────────────────────
-- notifications: recipient_id = uid() | trigger/service only |
-- recipient_id = uid(), read_at only | recipient_id = uid()
alter table public.notifications enable row level security;
alter table public.notifications force row level security;

revoke all on public.notifications from anon, authenticated;
grant select, delete on public.notifications to authenticated;
grant update (read_at) on public.notifications to authenticated;

create policy notifications_select on public.notifications
  for select
  to authenticated
  using (recipient_id = (select app.uid()));

create policy notifications_update on public.notifications
  for update
  to authenticated
  using (recipient_id = (select app.uid()))
  with check (recipient_id = (select app.uid()));

create policy notifications_delete on public.notifications
  for delete
  to authenticated
  using (recipient_id = (select app.uid()));

-- notification_preferences: not in the §4.6 table explicitly — a user
-- manages only their own, matching the profiles self-update pattern.
alter table public.notification_preferences enable row level security;
alter table public.notification_preferences force row level security;

revoke all on public.notification_preferences from anon, authenticated;
grant select, insert, update on public.notification_preferences to authenticated;

create policy notification_preferences_select on public.notification_preferences
  for select
  to authenticated
  using (profile_id = (select app.uid()));

create policy notification_preferences_insert on public.notification_preferences
  for insert
  to authenticated
  with check (profile_id = (select app.uid()));

create policy notification_preferences_update on public.notification_preferences
  for update
  to authenticated
  using (profile_id = (select app.uid()))
  with check (profile_id = (select app.uid()));
