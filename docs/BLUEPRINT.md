# Asset Bank — Technical Blueprint, Version 2

**Status:** Awaiting approval to begin Phase 0
**Supersedes:** Blueprint Version 1 (not retained; V1 contained errors corrected below)
**Last updated:** 2026-08-31

---

## 1. Corrections made in Version 2

| # | Correction | What changed |
|---|---|---|
| 1 | **Scope reduced to a practical first version** | Partitioned audit tables, audit export/archival, Realtime notifications, email digests, Resend webhooks and bounce processing, Sentry, PITR, automated storage exports, companion ZIP preview imports, scheduled cleanup jobs, and production monitoring/restore drills are all deferred to Appendix A. The first version does not depend on any of them. |
| 2 | **Authorization no longer trusts the JWT** | `public.profiles.role` and `public.profiles.status` are the sole authority. RLS helpers read the live profile through `SECURITY DEFINER` functions. JWT claims are a UI hint only. The custom access token hook is **removed from the design**. No authorization caching in cookies. Every sensitive Server Action re-checks live. |
| 3 | **Auth hook availability verified, with a fallback that is now the baseline** | Both `before-user-created` and `custom-access-token` hooks are documented as available on Supabase Free and Pro plans (only MFA-verification and password-verification hooks are Teams/Enterprise). Even so, the invitation gate is built on an `auth.users` trigger, which needs no plan feature. The hook is an optional enhancement, not a dependency. |
| 4 | **Account states simplified** | Invitations: `pending`, `accepted`, `revoked`, `expired`. Profiles: `active`, `suspended`. No `invited` profile state; no profile row until first successful sign-in. The UI derives "Invited" from the invitation record. |
| 5 | **Owner protection corrected** | A partial unique index gives *at most* one Owner, not exactly one. Added a controlled one-time bootstrap and a CI validation test asserting exactly one Owner exists. |
| 6 | **Application-level hard deletion removed** | No hard delete anywhere in the app, for any role, on any entity. Assets: draft/published/archived only. Curriculum and taxonomy: deactivate, never delete. |
| 7 | **Character identity rule corrected** | `UNIQUE (lower(name), grade_id)` is **removed**. Names are labels, not identities. Identity is the profile UUID plus a required grade. Optional unique `profile_code`. Duplicates produce a UI warning, never a rejection. |
| 8 | **Three-word title rule removed** | Titles need only be non-empty, trimmed, and within a length limit. "Blue timer" and "Philippine flag" are valid. Vagueness produces a warning, not a rejection. |
| 9 | **Taxonomy relationships normalized** | `taxonomies.applies_to text[]` replaced with `taxonomy_asset_types(taxonomy_id, asset_type_id)` with real foreign keys. Profession modeled as **one hierarchical taxonomy** (groups as parent terms, professions as child terms) — see §5.4 for the reasoning. |
| 10 | **Lesson code storage corrected** | The V1 generated column referenced `term_number`, which was not reliably on the row. Replaced with a `BEFORE INSERT OR UPDATE` trigger that derives and overwrites `code` from `grade_id`, `term_id`, and `lesson_number`, plus a unique constraint on `code` and guards against inconsistent edits upstream. |
| 11 | **Request visibility restricted** | Viewers see only requests they created or explicitly watch. Admin and Super Admin see all. Comments, deliverables, and history inherit the parent request's visibility. |
| 12 | **Archived-item conflict resolved** | Viewers cannot read archived asset metadata at all. Favorite and collection *relationships* persist, but archived assets disappear from Viewer catalog and collection views and reappear automatically on restore. |
| 13 | **Sign-in screen is branded** | `/login` carries branding, logo, heading, instructions, the invitation-only notice, and the "no Drive permissions requested" notice. It is not a bare button. |
| 14 | **Phase 0 corrected** | Phase 0 cannot render an authenticated shell. It delivers an unauthenticated shell and a non-functional branded sign-in UI. Google authentication begins in Phase 1. Versions are "current stable at implementation time", not pinned. |
| 15 | **Environment secrets reduced** | Six runtime variables. Google OAuth client ID/secret live in Supabase only. The Supabase JWT secret is not used or copied. The direct database URL is tooling-only and not required at runtime. No Google Drive credential of any kind exists. |

---

## 2. Updated architecture

### 2.1 Stack

| Layer | Choice |
|---|---|
| Framework | Next.js (App Router, TypeScript, React Server Components, Server Actions), current stable at implementation time |
| Runtime | Node.js, current stable LTS at implementation time |
| Styling | Tailwind CSS + shadcn/ui, with project design tokens |
| Database | Supabase PostgreSQL |
| Auth | Supabase Auth, Google OAuth, scopes `openid email profile` only |
| Authorization | Row Level Security, backed by live `profiles` lookups |
| Storage | Supabase Storage, private `asset-previews` bucket, previews only |
| Email | Resend, called directly from Server Actions in the first version |
| Validation | Zod, one schema shared by forms, Server Actions, and the importer |
| Spreadsheets | SheetJS, server-side only |
| Hosting | Vercel |

### 2.2 Runtime shape

```
Browser
  └─ Next.js on Vercel
       ├─ middleware: refresh session, then gate protected routes
       ├─ Server Components: read via user-scoped Supabase client (RLS applies)
       ├─ Server Actions: requireActive() / requireRole() → validate → write → audit
       └─ service-role client: 'server-only' modules, narrow and audited
Supabase
  ├─ Postgres: schema, RLS policies, triggers, app.* SECURITY DEFINER helpers
  ├─ Auth: Google OAuth + on_auth_user_created invitation gate trigger
  └─ Storage: private asset-previews bucket, signed URLs
Resend
  └─ transactional email, called directly from Server Actions
Google Drive
  └─ read-only, by URL only, no API client, no credentials, ever
```

### 2.3 Two Supabase clients

- **User-scoped client** (anon key + user session). The default everywhere. RLS applies.
- **Service-role client**. Confined to modules marked `server-only`. Used only for: creating the
  profile row during the invitation gate (executed as a database trigger, not from app code),
  revoking sessions on suspension, and the batch-import commit. Every service-role write emits an
  audit row.

An ESLint `no-restricted-imports` rule forbids importing `lib/supabase/service` from anywhere
outside an allow-listed directory, and forbids `googleapis` and any Google Drive SDK entirely.

### 2.4 Google Drive boundary

Drive links are plain `text` columns. The application validates URL shape and extracts a file ID
purely for de-duplication. There is no Drive API client, no scope, no credential, no service
account. Users' own Google accounts must already have Drive access to the linked files; the app
cannot grant it and does not try. See §12 Risk 1.

---

## 3. Project structure

```
asset-bank/
├─ CLAUDE.md
├─ docs/                       PRODUCT_SPEC, BLUEPRINT, DECISIONS, PROGRESS
├─ app/
│  ├─ (public)/
│  │  ├─ login/page.tsx        branded sign-in (only unauthenticated route)
│  │  ├─ callback/route.ts     OAuth code exchange
│  │  ├─ no-access/page.tsx    not invited
│  │  └─ suspended/page.tsx
│  ├─ (app)/                   viewer and above
│  │  ├─ page.tsx              catalog
│  │  ├─ assets/[id]/
│  │  ├─ characters/[profileId]/
│  │  ├─ favorites/
│  │  ├─ collections/[id]/
│  │  ├─ requests/[id]/
│  │  └─ notifications/
│  ├─ (admin)/admin/           admin and above
│  │  ├─ assets/ new/ [id]/edit/ queue/
│  │  ├─ imports/[batchId]/
│  │  ├─ curriculum/
│  │  └─ requests/
│  └─ (super)/super/           super admin only
│     ├─ users/  invitations/  taxonomy/  settings/  audit/
├─ components/  ui/ catalog/ assets/ curriculum/ requests/ admin/
├─ lib/
│  ├─ supabase/  client.ts  server.ts  service.ts('server-only')  middleware.ts
│  ├─ auth/      session.ts  permissions.ts  guards.ts  invitations.ts
│  ├─ validation/
│  ├─ import/    parse.ts  validate.ts  commit.ts
│  ├─ notifications/
│  ├─ audit/
│  ├─ drive.ts   URL parse + validate ONLY
│  ├─ images.ts  client-side resize
│  └─ env.ts     Zod-validated environment
├─ supabase/  migrations/  seed.sql  config.toml
├─ emails/
├─ types/database.types.ts
├─ tests/  unit/  rls/  e2e/
└─ scripts/  bootstrap-owner.sql  grant-super-admin.sql  check-owner.ts
```

---

## 4. Corrected authorization and RLS approach

### 4.1 Principle

**`public.profiles` is the authority.** The JWT identifies *who* the user is (`auth.uid()`). It
does not decide *what they may do*. Role and status are read live on every authorization
decision.

This costs one indexed primary-key lookup per policy evaluation, which the planner hoists to a
single InitPlan per statement. That is an acceptable price for correctness.

### 4.2 Helper functions

Defined in a private `app` schema, `SECURITY DEFINER`, `STABLE`, `SET search_path = ''`, with
`EXECUTE` revoked from `anon` and granted to `authenticated`.

```sql
app.uid()        -- auth.uid()
app.profile()    -- returns (role, status) from public.profiles where id = auth.uid()
app.is_active()  -- profile exists AND status = 'active'
app.is_admin()   -- is_active() AND role IN ('admin','super_admin')
app.is_super()   -- is_active() AND role = 'super_admin'
```

Two implementation details that matter:

1. **`SECURITY DEFINER` is what prevents policy recursion.** The helper reads `profiles` with the
   definer's privileges, so the `profiles` RLS policies are not re-evaluated inside the helper.
2. **`public.profiles` must therefore not have `FORCE ROW LEVEL SECURITY`.** `FORCE` subjects the
   table owner to RLS, which would reintroduce the recursion the definer function exists to
   avoid. `FORCE` is applied to every other table. This exception is deliberate and documented in
   `DECISIONS.md`.

Policies call helpers as `(select app.is_admin())` so Postgres evaluates them once per statement
rather than once per row.

### 4.3 Three enforcement layers

| Layer | Mechanism | Purpose |
|---|---|---|
| Database | RLS policies using `app.*` helpers | The real boundary. Assumes the app layer is compromised. |
| Server Action | `requireActive()` / `requireRole('admin')` in `lib/auth/guards.ts` | Fresh `profiles` read before any sensitive write. Fails closed. |
| Middleware | Refresh session, load live profile status, gate route groups | Ejects a suspended or profile-less user on the **next protected request**. |

**No authorization caching.** No status cookie, no signed status claim, no `localStorage`. The
only permitted memoization is React `cache()`, which is request-scoped and dies with the request.

### 4.4 Suspension propagation

1. Super Admin calls `app.suspend_user(target)`. Status flips to `suspended` in one transaction
   with an audit row.
2. **Immediately:** every RLS policy denies the user, because `app.is_active()` is now false.
   Data access stops even if the user holds a valid unexpired token.
3. **Next protected request:** middleware reads the live profile, signs the user out, and
   redirects to `/suspended`.
4. The suspension action also calls the admin API to revoke the user's refresh tokens, so the
   session cannot be silently renewed.

### 4.5 Invitation gate — verified availability and the chosen design

**Verified:** Supabase documents the `Before User Created` and `Custom Access Token` hooks as
available on the **Free and Pro** plans; only the MFA-verification and password-verification hooks
are restricted to Teams and Enterprise. Postgres hooks run inside the database with a 2-second
budget.

**Chosen design — the fallback is the baseline.** The gate is implemented as an
`AFTER INSERT ON auth.users` trigger, which requires no plan feature and cannot be disabled by a
billing change:

```
Google sign-in succeeds
  └─ auth.users row is created
       └─ trigger app.handle_new_user()
            ├─ find invitation WHERE lower(email) = lower(new.email)
            │                    AND status = 'pending' AND expires_at > now()
            ├─ MATCH   → INSERT profiles (role, default_key_stage_id from invitation,
            │            status='active'); UPDATE invitation → 'accepted'; audit
            ├─ NO MATCH, but email = app_settings.owner_bootstrap_email
            │            AND no Owner exists yet
            │          → INSERT profiles (super_admin, is_owner=true); clear the
            │            setting; audit  [one-time, self-disarming]
            └─ NO MATCH → do nothing. No profile row is created.
```

An uninvited account therefore:

- receives **no application profile**;
- is **denied by every RLS policy**, since `app.is_active()` is false without a profile;
- is **signed out immediately** by middleware on the callback redirect;
- is shown the **"not invited"** screen at `/no-access`.

An unused `auth.users` record is harmless: it grants nothing. `/super/users` lists these as
"Unrecognized sign-in attempts" so a Super Admin can see them and, if legitimate, issue an
invitation.

**Optional hardening (Phase 11, not a dependency):** enable the `before-user-created` Postgres
hook to reject uninvited signups before the `auth.users` row is written. Security is identical
either way — the hook only avoids orphan Auth records. Note that the trigger is still required,
because it is what creates the profile.

**Not used at all:** the custom access token hook. Since authorization reads `profiles` live,
there is nothing to put in the JWT.

### 4.6 Policy summary

`ENABLE ROW LEVEL SECURITY` on every table in `public`. `FORCE ROW LEVEL SECURITY` on every table
except `profiles` (see §4.2). All grants revoked from `anon`.

| Table | SELECT | INSERT | UPDATE | DELETE |
|---|---|---|---|---|
| `profiles` | `id = uid() OR is_admin()` | trigger only | self: name and default KS only (column-limited) · `is_super()` via RPC only | **none** |
| `invitations` | `is_super()` | `is_super()` | `is_super()` | **none** (revoke = status change) |
| `assets` | `is_active() AND (status='published' OR is_admin())` | `is_admin()` | `is_admin()` | **none** |
| `asset_*` join tables | `EXISTS` on a visible parent asset | `is_admin()` | `is_admin()` | `is_admin()` |
| `character_profiles` | `is_active()` | `is_admin()` | `is_admin()` | **none** |
| `asset_types`, `taxonomies`, `taxonomy_terms`, `taxonomy_asset_types` | `is_active()` | `is_super()` | `is_super()` | **none** |
| `key_stages`, `grades`, `terms`, `lessons` | `is_active()` | `is_admin()` | `is_admin()` | **none** |
| `favorites` | `profile_id = uid()` | same | — | same |
| `collections` | `owner_id = uid() OR visibility='team' OR is_super()` | `is_active()` | owner, editing member, or `is_super()` | owner or `is_super()` |
| `collection_items` | parent collection visible | parent editable | parent editable | parent editable |
| `asset_requests` | `app.can_see_request(id)` | `is_active() AND requested_by = uid()` | requester while `submitted` (title/description only) · `is_admin()` | **none** |
| `request_comments`, `request_deliverables`, `request_status_history`, `request_watchers` | `app.can_see_request(request_id)` | as §9 | author or `is_admin()` | **none** |
| `notifications` | `recipient_id = uid()` | trigger/service only | `recipient_id = uid()`, `read_at` only | `recipient_id = uid()` |
| `audit_log` | `is_super()` | **none for anyone** | **none** | **none** |
| `import_batches`, `import_rows` | `is_admin()` | `is_admin()` | `is_admin()` | **none** |
| `app_settings` | `is_super()` | `is_super()` | `is_super()` | **none** |

`app.can_see_request(uuid)` is a `SECURITY DEFINER` helper returning
`is_admin() OR requested_by = uid() OR EXISTS(watcher row for uid())`. Defining it as a function
prevents a policy cycle between `asset_requests` and `request_watchers`.

**Column-level protection.** `profiles.role`, `profiles.status`, and `profiles.is_owner` are
removed from the `authenticated` UPDATE grant. They change only through `SECURITY DEFINER` RPCs
(`app.set_user_role`, `app.suspend_user`, `app.reactivate_user`) that verify `is_super()`, refuse
Owner targets, refuse `super_admin` as a target role, and write audit rows atomically.

**Audit immutability.** `audit_log` has no INSERT, UPDATE, or DELETE grant for any role. Rows are
written only by `SECURITY DEFINER` functions. A `BEFORE UPDATE OR DELETE` trigger raises
unconditionally, so history survives even a leaked service key.

### 4.7 Owner protection and bootstrap

**Bootstrap (controlled, one-time):**

1. `scripts/bootstrap-owner.sql` sets `app_settings.owner_bootstrap_email` to the intended Owner's
   Google address. Run once, by a human, against the target database.
2. That person signs in with Google. `app.handle_new_user()` takes the Owner branch, creates the
   profile with `role='super_admin'`, `is_owner=true`, clears the setting, and writes an audit row.
3. The branch is now permanently inert: it requires both a non-null setting and zero existing
   Owners.

**Guarantees:**

- `CREATE UNIQUE INDEX ... ON profiles (is_owner) WHERE is_owner` → *at most* one Owner.
- `scripts/check-owner.ts` asserts `count(*) WHERE is_owner = 1` → *exactly* one Owner. Run as a
  CI test against the seeded local database and as a post-deploy check.
- A `BEFORE UPDATE OR DELETE ON profiles` trigger raises if the row is the Owner and the statement
  touches `role`, `status`, or `is_owner`, or is a `DELETE`. No UI, Server Action, RPC, or
  service-role call can bypass it.
- A trigger rejects any update setting `role = 'super_admin'` unless the transaction-local setting
  `app.allow_super_admin_grant` is on, which only `app.grant_super_admin()` sets. That function has
  `EXECUTE` revoked from `anon` and `authenticated`, so PostgREST cannot reach it; it is invoked
  only over a direct database connection.
- `invitations.role` carries `CHECK (role <> 'super_admin')`.

**Manual recovery** if the Owner's Google account is lost: documented in
`DECISIONS.md` §D-04 — a direct-connection SQL procedure that clears `is_owner`, sets
`owner_bootstrap_email` to the replacement address, and re-runs the bootstrap, leaving a full
audit trail. It is deliberately manual, deliberately awkward, and deliberately outside the app.
**A second protected Owner is not created automatically.**

---

## 5. Corrected entity model

All tables carry `id uuid default gen_random_uuid()`, `created_at`, `updated_at` unless noted.

### 5.1 Identity

**`profiles`** — created on first successful invited sign-in, never before.

```
id                    uuid PK → auth.users(id) ON DELETE CASCADE
email                 citext NOT NULL UNIQUE
full_name, avatar_url text
role                  role_enum NOT NULL DEFAULT 'viewer'   -- viewer | admin | super_admin
status                profile_status NOT NULL DEFAULT 'active'  -- active | suspended
is_owner              boolean NOT NULL DEFAULT false
default_key_stage_id  uuid → key_stages
invited_by            uuid → profiles
last_sign_in_at       timestamptz
suspended_at, suspended_by
```

**`invitations`**

```
id, email citext NOT NULL
role                 role_enum NOT NULL CHECK (role <> 'super_admin')
default_key_stage_id uuid → key_stages
invited_by           uuid NOT NULL → profiles
status               invitation_status NOT NULL   -- pending | accepted | revoked | expired
expires_at           timestamptz NOT NULL
accepted_at, accepted_profile_id
```

Partial unique index on `lower(email) WHERE status = 'pending'`. Expiry is evaluated as
`status='pending' AND expires_at > now()`; a nightly sweep to mark rows `expired` is cosmetic and
deferred.

### 5.2 Curriculum

```
key_stages (code UNIQUE 'KS1'|'KS2'|'KS3', name, sort_order)
grades     (key_stage_id FK, number int UNIQUE CHECK 1..8, label, sort_order)
terms      (number int UNIQUE CHECK 1..3, label)
lessons    (grade_id FK, term_id FK,
            lesson_number int NOT NULL CHECK 1..99,
            code text NOT NULL,          -- trigger-derived, never hand-edited
            title text NOT NULL, description text, is_active boolean DEFAULT true,
            UNIQUE (grade_id, term_id, lesson_number),
            UNIQUE (code))
```

**Corrected lesson-code mechanism.** `code` is an ordinary column maintained by a
`BEFORE INSERT OR UPDATE` trigger that looks up `grades.number` and `terms.number` and overwrites
`code` unconditionally:

```
NEW.code := 'M' || g.number || 'T' || t.number || 'L' || lpad(NEW.lesson_number::text, 2, '0')
```

Because the trigger always overwrites, a hand-edited `code` cannot persist. A companion
`BEFORE UPDATE` trigger on `grades` and `terms` blocks changing `number` while any lesson
references the row, so a stored code can never drift from its source. Example: `M3T2L07`.

### 5.3 Assets

**`asset_types`** — `(slug UNIQUE, name, is_system, allows_video, sort_order, is_active)`.
Seeded: characters, objects-and-backgrounds, math-tools, timers, template-tools. Super Admin may
add more.

**`character_profiles`** — identity is the UUID, not the name.

```
id                  uuid PK
name                text NOT NULL              -- a label, NOT an identity
profile_code        text UNIQUE                -- optional, nullable, admin-assigned
grade_id            uuid NOT NULL → grades     -- required
key_stage_id        uuid NOT NULL → key_stages -- derived from grade by trigger
character_type_term_id, gender_term_id, character_group_term_id → taxonomy_terms
description         text
cover_asset_id      uuid → assets (nullable)
is_active           boolean DEFAULT true
```

**No uniqueness constraint on name.** Two Grade 1 characters may both be called Mia and the
database accepts both. Grade 1 Mia and Grade 3 Mia are separate because they are separate UUIDs
with different grades. On create and rename, the UI runs a similarity check and shows a
non-blocking warning listing existing same-name profiles in that grade with their `profile_code`.

**`assets`**

```
id, title text NOT NULL CHECK (btrim(title) <> '' AND length(title) <= 160)
description         text
asset_type_id       uuid NOT NULL → asset_types
character_profile_id uuid → character_profiles   -- required iff type = characters (trigger)
status              asset_status NOT NULL DEFAULT 'draft'   -- draft | published | archived
review_state        review_state NOT NULL DEFAULT 'none'
                    -- none | ready_for_review | changes_requested
preview_path, preview_thumb_path text
preview_width, preview_height, preview_bytes int
drive_png_url, drive_eps_url, drive_mp4_url text
drive_png_file_id, drive_eps_file_id, drive_mp4_file_id text   -- parsed, de-dup only
primary_media       media_kind NOT NULL DEFAULT 'image'        -- image | video
search_text         text                                       -- trigger-maintained
search_tsv          tsvector GENERATED ALWAYS AS
                      (to_tsvector('english', coalesce(search_text,''))) STORED
created_by, updated_by, published_at, published_by, archived_at, archived_by
CHECK (coalesce(drive_png_url, drive_eps_url, drive_mp4_url) IS NOT NULL)
```

**Title rule corrected:** non-empty after trimming, at most 160 characters. No word count. The
form shows a soft warning when the title is a single word, or exactly matches the linked
character's name, or duplicates an existing title in the same grade. Warnings never block save or
publish.

Indexes: GIN on `search_tsv`; GIN `pg_trgm` on `title`; btree on `(status, asset_type_id)` and
`character_profile_id`.

**Join tables**

```
asset_key_stages     (asset_id, key_stage_id)   PK both
asset_grades         (asset_id, grade_id)       PK both
asset_lessons        (asset_id, lesson_id, added_by, created_at)  PK (asset_id, lesson_id)
asset_taxonomy_terms (asset_id, taxonomy_term_id) PK both
tags (name citext UNIQUE) ; asset_tags (asset_id, tag_id) PK both
```

### 5.4 Taxonomy — normalized

**`taxonomies`**

```
id, slug UNIQUE, name, description
is_multi        boolean NOT NULL   -- may an asset carry more than one term?
is_hierarchical boolean NOT NULL
is_system       boolean NOT NULL   -- cannot be deactivated; slug immutable
is_closed       boolean NOT NULL   -- rejects new terms
sort_order, is_active boolean DEFAULT true
```

**`taxonomy_asset_types`** — replaces `applies_to text[]`.

```
taxonomy_id  uuid NOT NULL → taxonomies   ON DELETE RESTRICT
asset_type_id uuid NOT NULL → asset_types ON DELETE RESTRICT
PRIMARY KEY (taxonomy_id, asset_type_id)
```

Real foreign keys, so an asset type can never be referenced by a slug that does not exist.

**`taxonomy_terms`**

```
id, taxonomy_id FK, parent_id FK self (nullable),
name, slug, sort_order, is_active boolean DEFAULT true, created_by,
UNIQUE (taxonomy_id, slug)
```

Seeded system taxonomies:

| slug | applies to | multi | hierarchical | closed |
|---|---|---|---|---|
| `character_group` | characters | no | no | no |
| `character_type` | characters | no | no | no |
| `profession` | characters | no | **yes** | no |
| `wardrobe` | characters | yes | no | no |
| `pose_action` | characters | no | no | no |
| `gender` | characters | no | no | **yes** (Female, Male) |
| `math_tool_kind` | math-tools | yes | no | no |
| `timer_style` | timers | yes | no | no |

Key Stage and Grade are **not** taxonomies. They are first-class curriculum tables because they
drive permissions, defaults, and lesson codes. They remain independently editable facets in the
UI.

Excluded per the product spec: no `visual_attributes`, no `display_language`.

#### Profession model — recommendation

**Recommended: one hierarchical `profession` taxonomy.** Level-0 terms are profession *groups*
(Healthcare, Education, Public Safety). Level-1 terms are *professions* (Nurse, Doctor under
Healthcare). Depth is capped at two by a trigger.

Why this over two taxonomies plus a mapping table:

- One maintenance screen instead of three. A Super Admin adds a profession directly under its
  group and is done.
- A profession cannot be orphaned or accidentally unmapped — the foreign key guarantees a parent.
- The group is derivable, so an asset stores one term id and filtering by group is a parent-id
  filter. No denormalized second column to keep in sync.
- Partial data works naturally: a character known to be "Healthcare" but not a specific role is
  tagged with the group term itself.

Both levels stay independently editable — group terms and profession terms are both ordinary rows
that can be added, renamed, reordered, and deactivated. "Profession group" and "Profession" remain
separate facets in the filter rail and on the asset form; they are two levels of one taxonomy
rather than two disconnected lists.

The trade-off: a profession belongs to exactly one group. If a profession genuinely needs to sit
under several groups, switch to two taxonomies plus an explicit
`profession_group_members(group_term_id, profession_term_id)` mapping table. That is a contained
change and is listed as an open question in §13.

#### Taxonomy guardrails

- `is_system` taxonomies cannot be deactivated and their slugs are immutable. Names and terms stay
  fully editable.
- `is_closed` taxonomies reject new terms; the UI hides the "add term" control. Gender is closed
  to Female and Male.
- Slugs are immutable after creation. Renames change `name` only, so code keyed on slug never
  breaks.
- **Terms are never deleted.** Deactivating hides a term from pickers while preserving existing
  assignments. Merging reassigns `asset_taxonomy_terms` from source to target in one transaction
  and deactivates the source, with a single audit row recording the affected count. The UI shows
  the usage count and offers merge instead of removal.
- Super Admin can create entirely new facets without a migration. A new facet immediately appears
  as a filter and as a form field because both are rendered from `taxonomies`.

### 5.5 Personalization

```
favorites          (profile_id, asset_id, created_at)  PK both
collections        (name, description, owner_id, visibility)  -- personal | team
collection_items   (collection_id, asset_id, position, added_by)  PK (collection_id, asset_id)
collection_members (collection_id, profile_id, can_edit boolean)  PK both
```

Archived assets stay in `favorites` and `collection_items`. The rows persist; the asset is simply
invisible to Viewers because of the `assets` SELECT policy. Restoring to `published` makes it
reappear with no data repair. Viewer-facing queries inner-join `assets`, so archived items drop
out of counts and grids silently rather than rendering as broken cards.

### 5.6 Requests

```
asset_requests (reference text UNIQUE 'REQ-0001', title, description,
                requested_by, asset_type_id, key_stage_id, grade_id, lesson_id,
                priority, needed_by date, status request_status,
                assigned_to, closed_at, closed_reason)
request_comments       (request_id, author_id, body, edited_at, deleted_at)
request_deliverables   (request_id, asset_id NULL, drive_url NULL, label, added_by)
request_status_history (request_id, from_status, to_status, changed_by, note)
request_watchers       (request_id, profile_id)  PK both
```

The requester is auto-added as a watcher on creation; commenters are auto-added. Watching is what
grants a Viewer visibility, so an Admin can bring a Viewer into a request by adding them as a
watcher.

### 5.7 Notifications

```
notifications            (recipient_id, type, title, body, entity_type, entity_id,
                          url, actor_id, read_at, created_at)
notification_preferences (profile_id, type, in_app boolean, email boolean) PK both
```

First version: in-app notifications are read on page load and via a lightweight poll on the bell
component. Email is sent directly to Resend from the Server Action that created the notification,
inside a `try/catch` so an email failure never rolls back the business transaction; a failure is
logged to `audit_log` and surfaced in the UI as "notification email failed". No outbox table, no
`pg_cron`, no Edge Function, no Realtime. Those are Appendix A.

### 5.8 Operations

```
audit_log      (id bigserial, actor_id, actor_email, actor_role, action,
                entity_type, entity_id, before jsonb, after jsonb,
                changed_fields text[], created_at)     -- single table, not partitioned
import_batches (kind, filename, uploaded_by, status, row_count, valid_count,
                error_count, committed_at, options jsonb)
import_rows    (batch_id, row_number, raw jsonb, normalized jsonb, status,
                errors jsonb, asset_id)
app_settings   (key text PK, value jsonb, updated_by, updated_at)
```

Audit capture is hybrid: a generic `app.audit_trigger()` on `profiles`, `invitations`, `assets`,
`asset_types`, `taxonomies`, `taxonomy_terms`, `lessons`, `asset_requests`, and `app_settings`
(fires regardless of code path, including direct SQL); plus an application-level `writeAudit()` for
events with no row change — sign-in, sign-in denied, authorization failure, import commit, bulk
publish. Indexes on `(entity_type, entity_id, created_at DESC)`, `(actor_id, created_at DESC)`,
`(action, created_at DESC)`. Partitioning and archival are deferred; the table is a plain table
sized for years of this team's volume.

---

## 6. Updated role-permission matrix

`—` denied. `Own` means only the user's own records.

| Capability | Viewer | Admin | Super Admin | Owner |
|---|:--:|:--:|:--:|:--:|
| Sign in (active invitation required) | ✓ | ✓ | ✓ | ✓ |
| Browse **published** assets | ✓ | ✓ | ✓ | ✓ |
| View **draft** and **archived** assets | — | ✓ | ✓ | ✓ |
| Search, filter, grid/list, asset detail | ✓ | ✓ | ✓ | ✓ |
| Open Google Drive links | ✓ | ✓ | ✓ | ✓ |
| See all Key Stages (defaults to assigned) | ✓ | ✓ | ✓ | ✓ |
| Favorites | Own | Own | Own | Own |
| Personal collections | Own | Own | Own | Own |
| Team-shared collections — read | ✓ | ✓ | ✓ | ✓ |
| Team-shared collections — create | ✓ | ✓ | ✓ | ✓ |
| Team-shared collections — edit | Own / member | Own / member | ✓ | ✓ |
| Submit an asset request | ✓ | ✓ | ✓ | ✓ |
| **See own + watched requests** | ✓ | ✓ | ✓ | ✓ |
| **See all requests** | **—** | ✓ | ✓ | ✓ |
| Comment on a visible request | ✓ | ✓ | ✓ | ✓ |
| Assign a request, change status | — | ✓ | ✓ | ✓ |
| Add watchers to a request | — | ✓ | ✓ | ✓ |
| Attach finished asset links | — | ✓ | ✓ | ✓ |
| Upload a single asset | — | ✓ | ✓ | ✓ |
| Edit asset metadata | — | ✓ | ✓ | ✓ |
| Upload / replace preview image | — | ✓ | ✓ | ✓ |
| Publish / unpublish / archive / restore | — | ✓ | ✓ | ✓ |
| Access the publishing queue | — | ✓ | ✓ | ✓ |
| Spreadsheet batch import | — | ✓ | ✓ | ✓ |
| Manage grades, terms, lessons | — | ✓ | ✓ | ✓ |
| Manage asset ↔ lesson usage | — | ✓ | ✓ | ✓ |
| Create / edit character profiles | — | ✓ | ✓ | ✓ |
| Deactivate a lesson or taxonomy term | — | ✓ (curriculum) | ✓ | ✓ |
| Create / edit taxonomies and terms | — | — | ✓ | ✓ |
| Create new asset types | — | — | ✓ | ✓ |
| Invite, revoke invitation | — | — | ✓ | ✓ |
| Suspend / reactivate users | — | — | ✓ | ✓ |
| Assign **Viewer / Admin** role | — | — | ✓ | ✓ |
| Assign **Super Admin** role | — | — | **— (protected manual DB operation)** | **— (protected manual DB operation)** |
| View audit log | — | — | ✓ | ✓ |
| Security settings, `app_settings` | — | — | ✓ | ✓ |
| **Hard-delete anything** | **—** | **—** | **—** | **—** |
| Modify the Owner account | — | — | **—** | Self only (name, default KS) |
| Be suspended / demoted / deleted | ✓ | ✓ | ✓ | **Never** |

Two rows deserve emphasis. **Hard deletion does not exist in the application for any role**,
including the Owner; permanent removal is an exceptional manual maintenance operation performed
outside the UI. And **Super Admin never appears in the role selector** — the dropdown offers
Viewer and Admin only.

---

## 7. Preview-image storage

Bucket `asset-previews`, **private**, 5 MB per object, MIME allow-list `image/png`, `image/jpeg`,
`image/webp`.

```
assets/{asset_id}/display-{rand}.webp
assets/{asset_id}/thumb-{rand}.webp
characters/{character_profile_id}/cover-{rand}.webp
```

Keyed by UUID, never by original filename.

1. Admin selects a file; the client validates type and size.
2. The browser resizes via `createImageBitmap` + canvas into **display** (longest edge 1200 px,
   WebP q80) and **thumb** (longest edge 400 px, WebP q75), preserving transparency. Doing this
   client-side avoids depending on Supabase's paid image-transformation feature and cuts egress.
3. A Server Action issues a scoped signed upload URL; the client uploads both derivatives directly
   to Storage, bypassing the Vercel request body limit.
4. The Server Action records paths, dimensions, and byte size, and writes an audit row.
5. Replacing a preview writes to a new randomized path and clears the old reference, so cached
   URLs never break mid-flight. Old objects are left in place; orphan cleanup is Appendix A.

Serving: catalog grids call `createSignedUrls()` in **batch**, one round-trip per page, 1-hour
TTL, cached in the RSC render. Detail pages sign individually.

Storage policies: SELECT `app.is_active()`; INSERT / UPDATE / DELETE `app.is_admin()`.

**MP4 assets:** the uploaded screenshot is stored exactly like any other preview, alongside
`drive_mp4_url`. There is no `<video>` element, no thumbnail extraction, no transcoding, and no
fetch of the Drive file. The detail page shows the screenshot with a play badge and an
"Open in Google Drive" button.

---

## 8. Publishing workflow

States: `draft` → `published` → `archived`, with restore paths. Nothing else.

```
      ┌───────────── unpublish ─────────────┐
      │                                     │
   [draft] ── publish ──► [published] ── archive ──► [archived]
      │                                                  │
      └────────────────── restore ◄──────────────────────┘
```

| From | To | Who |
|---|---|---|
| draft | published | Admin+ (preconditions met) |
| published | draft | Admin+ |
| published | archived | Admin+ |
| draft | archived | Admin+ |
| archived | draft | Admin+ |
| archived | published | Admin+ (preconditions re-validated) |

**Publish preconditions**, enforced by a `BEFORE UPDATE` trigger so no code path can bypass them:

1. `title` non-empty after trimming, within the length limit. *(No word count.)*
2. `asset_type_id` set.
3. At least one Drive URL present and passing shape validation.
4. `preview_path` present — including MP4 assets, whose preview is the uploaded screenshot.
5. At least one row in `asset_key_stages`.
6. If the type is Characters: `character_profile_id` set and a `pose_action` term assigned.
7. `primary_media = 'video'` requires `drive_mp4_url`.

**Review queue.** Rather than a fourth lifecycle state, drafts carry `review_state`
(`none` / `ready_for_review` / `changes_requested`). `/admin/assets/queue` lists drafts marked
ready, with a per-item precondition checklist, batch publish for fully valid items, and a
"request changes" action that notifies the creator.

---

## 9. Asset-request workflow

```
[submitted] ─► [under_review] ─► [approved] ─► [in_progress] ─► [completed]
     │               │                │              │
     │               ▼                ▼              ▼
     │          [rejected]       [rejected]     [on_hold] ─► [in_progress]
     ▼
[cancelled]   (requester, while submitted or under_review)
```

| Status | Who may enter it | Requirement |
|---|---|---|
| `submitted` | any active user, own request | — |
| `under_review` | Admin+ | — |
| `approved` | Admin+ | — |
| `in_progress` | Admin+ | `assigned_to` set to an Admin or Super Admin |
| `on_hold` | Admin+ | non-empty note |
| `completed` | Admin+ | at least one deliverable |
| `rejected` | Admin+ | non-empty note |
| `cancelled` | requester or Admin+ | — |

Every transition inserts a `request_status_history` row; the transition matrix is enforced by a
trigger, so illegal jumps are rejected at the database. `completed`, `rejected`, and `cancelled`
set `closed_at`. Reopening returns to `under_review`, clears `closed_at`, and is Admin-only.

**Visibility, corrected.** Requests are not globally readable. A Viewer sees a request only if
they created it or are a watcher. Comments, deliverables, history, and the watcher list all
inherit that visibility through `app.can_see_request()`. Duplicate prevention by way of a limited
title-only search is a future consideration and must never expose descriptions or comments.

`/admin/requests` gives Admins a board grouped by status with filters for assignee, priority, Key
Stage, grade, and overdue `needed_by`.

---

## 10. Spreadsheet import

Three import kinds, each with a downloadable XLSX template carrying a locked header row, a
validation sheet, and an instructions tab: `assets`, `characters`, `lessons`.

```
1. UPLOAD    .xlsx / .csv, ≤ 2000 rows, ≤ 10 MB. A batch row is created.
2. PARSE     Server-side SheetJS. Header checked against the template signature.
3. NORMALIZE Trim, collapse whitespace, split pipe-delimited lists, parse Drive file IDs,
             coerce grade / term / lesson to integers. Stored in import_rows.
4. VALIDATE  The same Zod schema the single-asset form uses, plus referential checks against
             asset_types, taxonomy_terms, lessons, and character_profiles. Cross-row duplicate
             detection. Existing-asset detection by Drive file ID.
5. REPORT    Dry run: N valid, N invalid, N duplicates, N unknown terms. Errors are
             cell-addressable ("Row 42, pose_action: 'wavng' not found — did you mean
             'waving'?"), with a downloadable error-annotated copy of the file.
6. RESOLVE   Fix and re-upload, or choose per-issue: skip row / create missing term
             (Super Admin only) / update existing asset.
7. COMMIT    Chunks of 100 rows, one transaction per chunk, progress streamed. Partial failure
             marks only that chunk.
8. RESULT    Every row lands as status='draft'. One audit row per asset plus a batch summary.
             Notification to the uploader.
```

Hard rules: imports **never** publish; imports **never** create taxonomy terms silently; imports
**never** touch Google Drive. Rows without a preview import as drafts that simply fail the publish
precondition until an image is uploaded. Companion ZIP preview matching is deferred to Appendix A.

Character imports create profiles by UUID and do **not** deduplicate on name — a repeated name in
the same grade produces a warning in the dry-run report, and the admin decides whether it is a
genuine second character or a mistake.

---

## 11. Simplified implementation phases

Eleven phases. Each is independently shippable, independently testable, and ends in a demonstrable
state.

| # | Phase | Exit criteria |
|---|---|---|
| **0** | **Foundations** — see §12 | `pnpm dev` renders the unauthenticated shell and the branded, non-functional sign-in page; local Supabase starts; CI green |
| **1** | **Auth, invitations, users, Owner** — see §13 | An invited user signs in; an uninvited user is refused with no profile; suspension takes effect on the next protected request; the Owner cannot be demoted; RLS suite passes |
| **2** | **Curriculum and taxonomy** | Grades 1–8, Terms 1–3, KS1–KS3, lesson codes generated correctly; taxonomies and terms manageable, deactivatable, mergeable |
| **3** | **Asset core** | An Admin creates, previews, and publishes one asset end to end; publish preconditions enforced by trigger; archive and restore work |
| **4** | **Catalog and search** | A Viewer finds a published asset by any facet, switches grid/list, opens its Drive link; archived assets are invisible to Viewers |
| **5** | **Characters, poses, and lesson assignment** | Two same-named Grade 1 profiles coexist; poses group under their profile; the grade → term → lesson picker assigns one asset across multiple grades and terms |
| **6** | **Favorites and collections** | Personal and team collections work; archived assets vanish from Viewer collections and reappear on restore; RLS verified |
| **7** | **Requests** | A request travels submitted → completed with a linked deliverable; a Viewer sees only own and watched requests |
| **8** | **Notifications** | In-app notifications and direct Resend emails fire for the event catalogue; preferences respected; an email failure does not roll back the action |
| **9** | **Batch import** | A 500-row file imports as drafts with a correct, cell-addressable validation report |
| **10** | **Audit console and production readiness** | Every privileged action traceable at `/super/audit`; audit rows provably immutable; production Supabase project, OAuth consent configured, backups on, Owner bootstrapped, UAT complete |

Sequencing: phases 0–3 are the strict critical path. Phases 4–7 partially parallelize. Audit
instrumentation is added *within* each phase, not deferred wholesale to phase 10.

---

## 12. Corrected Phase 0 scope

Phase 0 has **no authentication**, therefore no authenticated shell and no protected routes.

**Delivers:**

- Next.js + TypeScript project at the repository root, current stable versions, strict mode.
- Tailwind + shadcn/ui, design tokens, Asset Bank / Class Builder brand primitives, light and dark
  handling, base layout.
- **The branded sign-in UI in a non-functional state** at `/login`: branding, logo, "Sign in to
  Asset Bank", the instruction to use the personally invited Google account, a disabled
  "Continue with Google" button, the invitation-only notice, and the "Google Drive permissions are
  not requested" notice. No OAuth wiring.
- An unauthenticated application shell / development preview so layout and components can be
  reviewed before auth exists.
- Supabase local development: `supabase/config.toml`, `supabase start`, `supabase db reset`,
  and an empty-but-working `migrations/` + `seed.sql` structure.
- `lib/env.ts` — Zod validation of the environment at startup, failing fast with a readable
  message. `.env.example` with **blank** placeholders.
- Testing foundations: Vitest for unit tests, a Playwright harness, an empty `tests/rls/` suite
  with a working local-database runner, and the CI pipeline (typecheck, lint, format, unit,
  `supabase db reset`).
- `.gitignore`, ESLint with the `no-restricted-imports` rules banning `googleapis`, any Drive SDK,
  and out-of-scope imports of the service-role client.
- Type generation script producing `types/database.types.ts`.

**Explicitly not in Phase 0:** Google OAuth, any auth code, `profiles`, any RLS policy, any
business table, middleware route protection, and every feature domain.

---

## 13. Corrected Phase 1 scope

**Phase 1: Authentication, invitations, users, and Owner protection.**

**Migrations**

- Enums: `role_enum` (viewer, admin, super_admin), `profile_status` (active, suspended),
  `invitation_status` (pending, accepted, revoked, expired).
- Tables: `key_stages`, `grades` (needed for `default_key_stage_id`), `profiles`, `invitations`,
  `audit_log` (plain table), `app_settings`.
- `app` schema helpers: `uid()`, `profile()`, `is_active()`, `is_admin()`, `is_super()` —
  `SECURITY DEFINER`, `STABLE`, `search_path = ''`, execute revoked from `anon`.
- RLS enabled on all Phase 1 tables; `FORCE` on all except `profiles` (§4.2); policies per §4.6.
- `app.handle_new_user()` invitation-gate trigger on `auth.users`, including the one-time,
  self-disarming Owner-bootstrap branch.
- Owner-protection trigger; super-admin-grant guard trigger; `invitations.role` CHECK; partial
  unique index on `is_owner`.
- `app.write_audit()` and the generic `app.audit_trigger()`, attached to `profiles` and
  `invitations`; `audit_log` immutability trigger and revoked grants.
- RPCs: `app.set_user_role`, `app.suspend_user`, `app.reactivate_user`,
  `app.grant_super_admin` (execute revoked from `anon` and `authenticated`).
- `seed.sql`: KS1–KS3, Grades 1–8, and a local development Owner.

**Supabase configuration**

- Google provider enabled with `openid email profile` only. No Drive scope.
- Redirect URLs for local, preview, and production.
- No auth hook required. No custom access token hook.

**Application**

- `/login` becomes functional; the branding from Phase 0 is unchanged.
- `/callback` route handler: code exchange, then profile check, then redirect to `/`,
  `/no-access`, or `/suspended`.
- `/no-access` and `/suspended` pages.
- `middleware.ts`: session refresh, live profile status check on every protected request, route
  group gating, 403 handling with an audit row. **No status caching in cookies.**
- `lib/auth/permissions.ts` encoding the §6 matrix; `lib/auth/guards.ts` providing
  `requireActive()` and `requireRole()` for Server Actions.
- `/super/invitations`: create (Viewer or Admin only), list, resend, revoke, expiry display.
- `/super/users`: list, filter, change role between Viewer and Admin, suspend, reactivate, with
  the Owner row visibly locked and a section listing unrecognized sign-in attempts.
- An authenticated shell with a placeholder catalog page at `/`.

**Email**

- Resend integration and one template: the invitation email, sent directly from the Server Action.

**Scripts**

- `scripts/bootstrap-owner.sql`, `scripts/grant-super-admin.sql`, `scripts/check-owner.ts`.

**Tests**

- RLS: a Viewer cannot read `invitations` or `audit_log`; an Admin cannot change roles; a Super
  Admin cannot modify the Owner; nobody can update or delete `audit_log`; a suspended profile
  reads nothing; a session with no profile reads nothing.
- Owner validation: exactly one Owner exists after seeding.
- E2E: an invited user signs in; an uninvited user is refused, receives no profile, and is signed
  out to `/no-access`; a suspended user is ejected on the next protected request; the Owner row
  exposes no destructive action.
- Unit: `permissions.ts` across every matrix cell.

**Out of scope for Phase 1:** assets, previews, storage buckets, taxonomy, terms and lessons,
catalog, search, favorites, collections, requests, in-app notifications, batch import, and the
audit console UI. Audit rows are written in Phase 1 but read only via SQL until Phase 10.

---

## 14. Environment variables

**Runtime — the complete set.**

```bash
# Public
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
NEXT_PUBLIC_SITE_URL=              # canonical origin, used for the OAuth redirect

# Server only — never NEXT_PUBLIC_
SUPABASE_SERVICE_ROLE_KEY=
RESEND_API_KEY=
RESEND_FROM_EMAIL=
```

**Tooling only — a developer's machine and CI. Never set in Vercel.**

```bash
SUPABASE_DB_URL=                   # migrations and administrative scripts only
```

**Deliberately absent:**

- `GOOGLE_OAUTH_CLIENT_ID` / `GOOGLE_OAUTH_CLIENT_SECRET` — configured in the Supabase dashboard.
  The application code never sees them.
- `SUPABASE_JWT_SECRET` — not used. Authorization reads `profiles`, so nothing verifies or mints
  JWTs outside Supabase.
- Any Google Drive credential, token, API key, or service account. **None will ever exist.**
- `CRON_SECRET`, `SENTRY_DSN`, `RESEND_WEBHOOK_SECRET` — the features that need them are deferred.

Fixed values (bucket name, signed-URL TTL, max upload bytes, import limits) are constants in code.
Operationally tunable values (invitation expiry, audit retention) live in `app_settings`. Neither
belongs in the environment.

`.env.example` ships every runtime key with a blank value. `lib/env.ts` validates at startup and
fails fast.

---

## 15. Local development and deployment

**Prerequisites:** current Node.js LTS, pnpm, Docker Desktop (for the Supabase CLI stack), the
Supabase CLI, and a Google Cloud OAuth client (Web application) whose authorized redirect URIs
cover local, Vercel preview, and production.

```
pnpm install
supabase start
supabase db reset      # migrations + seed
pnpm gen:types
pnpm dev
```

**Environments:** local (CLI stack), staging (dedicated Supabase project + Vercel preview), and
production (separate dedicated Supabase project). Staging and production are **separate Supabase
projects** — a migration mistake in staging must never be able to reach production data. Neither
should sit on the free tier, because free projects pause.

**CI:** on every PR — typecheck, lint, format check, Vitest, `supabase db reset` against a
throwaway instance, the RLS policy suite, the Owner validation test, and Playwright smoke tests.
All required. Vercel preview per PR against staging.

**Release:** merge to `main` → migrations applied to production through a gated workflow requiring
manual approval → Vercel production deploy. Migrations are forward-only and additive; destructive
changes ship across two releases.

**Baseline operations for the first version:** Supabase daily backups enabled, and that is the
whole list. Monitoring, restore drills, PITR, and error tracking are Appendix A.

**Deployment configuration note (not a blocker):** with no Workspace domain, the Google OAuth
consent screen is External. With only non-sensitive scopes, no Google verification review is
required, but an unpublished External app is limited to a fixed number of test users. The invited
user count will be confirmed before OAuth is configured; if it exceeds the limit, the consent
screen is published to Production, which is self-service for non-sensitive scopes.

---

## 16. Risks and blockers

1. **Drive access is out of band.** The app stores links but cannot grant access to them. If a
   Drive file's sharing settings exclude a viewer's personal Google account, the link fails and the
   app cannot detect or explain it. Mitigation: a documented link-sharing convention, a "report
   broken link" button on every asset, and periodic manual review. This is a team process, not
   code. **This remains the largest operational risk.**
2. **The Owner account is a single point of failure.** One protected, non-demotable account tied to
   one personal Google address. Mitigated by the documented manual recovery procedure. A second
   protected Owner is deliberately not created.
3. **Gmail alias ambiguity.** Dots and plus-addressing make one Google account match many strings.
   Auto-normalizing would create an impersonation risk on non-Gmail domains, so invitations must
   use the exact sign-in address. The invitation form warns on Gmail addresses containing a dot or
   a plus.
4. **Email deliverability to personal Gmail.** Without SPF, DKIM, and DMARC on a verified sending
   domain, invitation emails land in spam. This requires DNS access — a dependency outside the
   codebase. Needed before Phase 1 email is useful.
5. **Live profile lookups on every policy evaluation** cost more than reading a JWT claim. Measured
   at this team's scale it is negligible, but if the catalog ever becomes slow, the fix is indexing
   and query shape, **not** moving authorization back into the token.
6. **Grade-specific character duplication is intentional but laborious.** Eight grade variants of
   one character mean eight profiles and potentially dozens of assets. The batch importer is the
   mitigation, which is why it is a first-class phase.
7. **Taxonomy sprawl.** Freely editable facets drift without governance. Merge tooling and usage
   counts help; the rest is process discipline.
8. **Vercel function limits** on import commits, mitigated by chunking.
9. **Stored Drive file IDs are for de-duplication only** and must never become a justification for
   adding an API client. The ESLint rule is the guardrail.

---

## 17. Open decisions

These genuinely need an answer. Everything else is decided.

1. **Profession model.** Confirm the recommended single hierarchical `profession` taxonomy
   (groups as parent terms, professions as children). Only switch to two taxonomies plus a mapping
   table if a profession must belong to more than one group.
2. **Team-collection editing.** Can any active user edit any team collection, or only the owner and
   explicitly added members? The blueprint currently assumes owner + members, with Super Admin
   override.
3. **Request visibility for Admins in the Viewer UI.** Admins see all requests on the admin board.
   Should the Viewer-side `/requests` list also show them everything, or stay scoped to own +
   watched for a cleaner personal view?
4. **Invitation expiry window.** 14 days is proposed. Confirm or change.
5. **Sending domain for Resend.** Which domain or subdomain will send invitation email, and who can
   add the SPF, DKIM, and DMARC records? This blocks useful email in Phase 1.
6. **Brand assets.** The Class Builder logo files, colour values, and any typeface licence are
   needed for Phase 0's branded sign-in page.

---

## Appendix A — deferred production improvements

Not part of the first version. Recorded so they are not forgotten, and so nothing in the initial
build depends on them.

| Item | Revisit when |
|---|---|
| Partitioned audit tables | `audit_log` growth makes queries slow |
| Audit-log export and archival | A retention policy is formally required |
| Realtime notifications | Polling proves insufficient |
| Email digests | Notification volume causes complaints |
| Resend webhooks and bounce processing | Delivery failures need automatic tracking |
| Sentry or equivalent error tracking | Post-launch, once real usage exists |
| Point-in-time recovery | Data volume justifies the plan cost |
| Automated storage exports | Preview library becomes hard to reconstruct |
| Companion ZIP preview imports | Manual preview upload becomes the bottleneck |
| Scheduled cleanup jobs (orphan previews, invitation expiry sweep) | Orphans or stale rows accumulate |
| Production monitoring and restore drills | Before the app becomes business-critical |
| `before-user-created` auth hook | Optional hardening; orphan Auth records become annoying |
| Limited request-title search for duplicate prevention | Duplicate requests become a real problem |
