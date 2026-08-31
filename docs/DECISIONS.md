# Asset Bank — Architectural Decisions

Append-only. When a decision is reversed, add a new entry that supersedes the old one rather than
editing history. Each entry states the decision, why, what was rejected, and the consequence.

---

## D-01 — `profiles` is the sole authorization authority, not the JWT
**Date:** 2026-08-31 · **Status:** Accepted

**Decision.** `public.profiles.role` and `public.profiles.status` are the only authority for
authorization. RLS policies resolve them live through `app` schema `SECURITY DEFINER` helpers.
JWT claims may be used as a UI hint and never as the sole basis for a security decision.

**Why.** JWT claims go stale. A suspended user or a demoted admin holds a valid token carrying
their old role until it expires. Shortening token lifetime narrows the window but never closes it.
For an internal tool where suspension is a real administrative action, a window of *any* size is
the wrong trade.

**Rejected.** The custom access token hook injecting `app_role` and `app_status` into the JWT
(Blueprint V1). It is faster but wrong.

**Consequences.**
- The custom access token hook is removed from the design entirely.
- Every RLS policy evaluation costs one indexed primary-key lookup, hoisted by the planner to a
  single InitPlan per statement.
- No authorization state may be cached in a cookie, `localStorage`, or any client-controlled or
  long-lived store. Request-scoped React `cache()` only.
- Every sensitive Server Action re-reads the profile before acting.
- Suspension denies data access immediately at the database and ejects the user on the next
  protected request.

---

## D-02 — `public.profiles` is exempt from `FORCE ROW LEVEL SECURITY`
**Date:** 2026-08-31 · **Status:** Accepted

**Decision.** RLS is enabled on every table in `public`. `FORCE ROW LEVEL SECURITY` is applied to
every table **except** `profiles`.

**Why.** The `app.*` helpers are `SECURITY DEFINER` precisely so that reading `profiles` inside a
policy does not re-trigger the `profiles` policies and recurse. `FORCE` subjects the table owner
to RLS, which would reintroduce exactly that recursion.

**Consequences.** This exception must be preserved. Anyone adding `FORCE` to `profiles` will break
every policy in the system in a way that surfaces as an obscure recursion error. The RLS test
suite includes a test asserting the exemption is still in place.

---

## D-03 — The invitation gate is a database trigger, not an auth hook
**Date:** 2026-08-31 · **Status:** Accepted

**Verified.** Supabase documents both the `Before User Created` and `Custom Access Token` hooks as
available on the **Free and Pro** plans. Only the MFA-verification and password-verification hooks
are restricted to Teams and Enterprise. So the hook *is* available on the plan we are likely to
use.

**Decision.** Even so, the gate is implemented as an `AFTER INSERT ON auth.users` trigger,
`app.handle_new_user()`. The `before-user-created` hook is optional hardening, deferred to
Appendix A.

**Why.** The trigger requires no plan feature, cannot be disabled by a billing change, and is
needed regardless because something has to create the profile row. Building the security model on
a plan-gated feature would mean a downgrade silently removes a security control. An unused
`auth.users` record is harmless — it grants nothing.

**Consequences.** An uninvited Google sign-in may create an `auth.users` row. That account gets no
profile, is denied by every RLS policy, is signed out immediately, and lands on `/no-access`.
`/super/users` lists these as unrecognized sign-in attempts. If orphan Auth records become
annoying, enabling the hook is an additive change with no security implications.

---

## D-04 — One protected Owner, controlled bootstrap, manual recovery
**Date:** 2026-08-31 · **Status:** Accepted

**Decision.** Exactly one protected Owner. Created by a one-time, self-disarming bootstrap branch
inside `app.handle_new_user()`, triggered by `app_settings.owner_bootstrap_email`. No second
protected Owner is created automatically.

**Why.** A partial unique index guarantees *at most* one Owner — it cannot guarantee *exactly*
one, and Blueprint V1 wrongly implied it could. The gap is closed by pairing the index with a
validated bootstrap and an explicit test.

**Guarantees.**
- Partial unique index on `is_owner` → at most one.
- `scripts/check-owner.ts` asserts exactly one, in CI and post-deploy.
- A trigger blocks demotion, suspension, deletion, and `is_owner` changes for the Owner row, from
  any path including service-role.
- `app.grant_super_admin()` is the only route to Super Admin; its `EXECUTE` is revoked from `anon`
  and `authenticated` so PostgREST cannot reach it. It runs over a direct database connection only.
- `invitations.role` has `CHECK (role <> 'super_admin')`.

**Recovery procedure** if the Owner's Google account is lost. Direct database connection, by a
human, with the steps recorded:
1. Confirm identity out of band. This is a social step, not a technical one.
2. `select id, email from public.profiles where is_owner;` — record the current Owner.
3. In one transaction: `update public.profiles set is_owner = false where is_owner;` (this
   requires temporarily disabling the protection trigger with `alter table ... disable trigger`,
   which is itself audited), then re-enable the trigger.
4. `update public.app_settings set value = '"new.owner@example.com"' where key =
   'owner_bootstrap_email';`
5. The replacement signs in with Google. The bootstrap branch runs and disarms itself.
6. `pnpm check:owner` to confirm exactly one Owner.
7. Record the incident in `PROGRESS.md`.

**Why manual.** Deliberately awkward and deliberately outside the application. An automated
recovery path is an automated privilege-escalation path.

---

## D-05 — No hard delete anywhere in the application
**Date:** 2026-08-31 · **Status:** Accepted

**Decision.** No role, including the Owner, can permanently delete anything through the
application. Assets move only among draft, published, and archived. Curriculum records and
taxonomy terms are deactivated. Users are suspended. Invitations are revoked. `DELETE` policies
are absent from nearly every table.

**Why.** This is an internal asset library where the cost of an accidental deletion — losing
metadata, lesson usage, favorites, collection membership, request history, and audit context — far
exceeds the cost of keeping a row. Archived is always recoverable; deleted is not.

**Rejected.** Blueprint V1's Super-Admin hard-delete action.

**Consequences.** Permanent removal, if ever genuinely required, is an exceptional manual
maintenance operation performed over a direct connection, outside the UI, and documented in
`PROGRESS.md` when it happens. Archived assets retain metadata, previews, lesson usage, favorites,
collections, request relationships, and audit history.

---

## D-06 — Character identity is a UUID plus a grade; names are labels
**Date:** 2026-08-31 · **Status:** Accepted

**Decision.** `character_profiles` has no uniqueness constraint on name. Identity is the profile
UUID plus a required `grade_id`. An optional unique `profile_code` provides human-readable
identification. Duplicate names produce a UI warning, never a rejection.

**Why.** Blueprint V1 used `UNIQUE (lower(name), grade_id)`. That is wrong: two genuinely distinct
Grade 1 characters may coincidentally both be called Mia, and the database must allow it. Grade 1
Mia and Grade 3 Mia are already separate by virtue of different UUIDs and different grades — the
name constraint was solving a problem the model had already solved, while creating a real one.

**Consequences.** The UI must carry the burden the constraint used to: a similarity check on
create and rename, listing existing same-name profiles in that grade with their `profile_code`.
The batch importer flags repeated names in the dry-run report and lets the admin decide.

---

## D-07 — Descriptive titles are encouraged by warning, not enforced by word count
**Date:** 2026-08-31 · **Status:** Accepted

**Decision.** `assets.title` must be non-empty after trimming and at most 160 characters. There is
no minimum word count. "Blue timer" and "Philippine flag" are valid.

**Why.** Blueprint V1's three-word minimum was an arbitrary proxy for descriptiveness that would
have rejected many correct titles while doing nothing to stop a bad three-word one.

**Consequences.** The form shows a non-blocking warning when a title is a single word, exactly
matches the linked character's name, or duplicates an existing title in the same grade. The
publish precondition checks for a meaningful non-empty title, not a word count.

---

## D-08 — Taxonomy relationships are normalized; profession is one hierarchical taxonomy
**Date:** 2026-08-31 · **Status:** Accepted (profession model pending confirmation — Blueprint §17)

**Decision.** `taxonomies.applies_to text[]` is replaced by
`taxonomy_asset_types(taxonomy_id, asset_type_id)` with real foreign keys. Profession is modeled
as a **single hierarchical `profession` taxonomy**: level-0 terms are groups, level-1 terms are
professions, depth capped at two by trigger.

**Why.** The array stored asset-type slugs with no referential integrity, so a renamed or removed
asset type would leave a dangling string. And V1 was internally inconsistent about profession: it
described `profession` as a child of `profession_group` while modeling them as two separate
taxonomies with a self-referencing `parent_id`, which cannot express that relationship.

**Why one taxonomy over two plus a mapping table.** One maintenance screen instead of three. A
profession cannot be orphaned, because the foreign key guarantees a parent. The group is derivable,
so an asset stores one term and group filtering is a parent-id filter with nothing to keep in sync.
Partial data works naturally — a character known only to be "Healthcare" gets the group term
itself. Both levels remain independently editable and both remain separate facets in the UI.

**Trade-off.** A profession belongs to exactly one group. If that proves too restrictive, switch to
two taxonomies plus `profession_group_members`. That change is contained.

---

## D-09 — Lesson codes are trigger-derived, not generated columns
**Date:** 2026-08-31 · **Status:** Accepted

**Decision.** `lessons` stores `grade_id`, `term_id`, and `lesson_number`. `code` is an ordinary
column overwritten unconditionally by a `BEFORE INSERT OR UPDATE` trigger, with a unique
constraint. Triggers on `grades` and `terms` block changing `number` while lessons reference the
row.

**Why.** Blueprint V1 used a stored generated column referencing `term_number`, a value that was
not reliably present on the row. Postgres generated columns cannot reference other tables, and V1's
workaround of denormalizing both numbers onto every lesson row created two more fields to keep in
sync.

**Consequences.** A hand-edited `code` cannot persist — the trigger overwrites it on every write.
The stored code can never drift from its source, because the source numbers cannot change while
referenced. Format: `M<grade>T<term>L<two-digit lesson>`, e.g. `M3T2L07`.

---

## D-10 — Requests are private by default
**Date:** 2026-08-31 · **Status:** Accepted

**Decision.** A Viewer sees a request only if they created it or are an explicit watcher. Admins
and Super Admins see all. Comments, deliverables, status history, and the watcher list inherit the
parent request's visibility via the `app.can_see_request()` helper.

**Why.** Blueprint V1 made every request globally readable to prevent duplicate filing. That
exposes descriptions and comments — which may contain candid feedback, deadlines, or internal
context — to the whole team for a marginal convenience benefit.

**Consequences.** Duplicate prevention loses its automatic mechanism. A limited **title-only**
search is a future consideration and must never expose descriptions or comments. Admins can pull a
Viewer into a request by adding them as a watcher, which is now the deliberate mechanism for
sharing. `can_see_request()` is a function rather than an inline policy expression, to prevent a
policy cycle between `asset_requests` and `request_watchers`.

---

## D-11 — Archived assets are invisible to Viewers everywhere
**Date:** 2026-08-31 · **Status:** Accepted

**Decision.** Viewers cannot read archived asset metadata at all. Favorite and collection *rows*
persist untouched. Archived assets disappear from Viewer catalog results and Viewer collections,
and reappear automatically if restored to published. Admins and Super Admins can view archived
assets.

**Why.** Blueprint V1 contradicted itself: it restricted Viewers to published assets in RLS while
describing greyed-out archived cards in Viewer collections. The card cannot render without reading
the metadata the policy forbids.

**Consequences.** Viewer-facing queries inner-join `assets`, so archived items drop out of grids
and counts silently rather than rendering as broken cards. No data repair is needed on restore.
Viewers get no explanation for a disappearance; if that becomes confusing in practice, the fix is
a notification on archive, not a relaxation of the policy.

---

## D-12 — Notifications ship without an outbox, cron, Realtime, or webhooks
**Date:** 2026-08-31 · **Status:** Accepted

**Decision.** In-app notifications are read on page load and by a lightweight poll on the bell.
Email goes directly to Resend from the Server Action that created the notification, wrapped in
`try/catch` so a failure cannot roll back the business transaction; failures are audited and
surfaced in the UI.

**Why.** Blueprint V1 specified an `email_outbox` table drained by a `pg_cron`-scheduled Edge
Function, plus Realtime delivery, digests, and bounce webhooks. That is the right architecture at
scale and unnecessary machinery for a single visual-design team's notification volume.

**Consequences.** A Resend outage means some emails are lost rather than retried. In-app
notifications still record everything, so nothing is silently dropped from the record. The outbox,
Realtime, digests, and webhooks are in Appendix A and can be added without schema disruption —
`notifications` is already the single source of truth and email is already a downstream fanout.

---

## D-13 — Six runtime environment variables
**Date:** 2026-08-31 · **Status:** Accepted

**Decision.** Runtime: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
`NEXT_PUBLIC_SITE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY`, `RESEND_FROM_EMAIL`.
Tooling only, never in Vercel: `SUPABASE_DB_URL`.

**Why.** Every secret in an environment is a secret that can leak. Blueprint V1 listed roughly
twenty-five variables, several of which the application never reads.

**Removed and why.**
- Google OAuth client ID and secret — configured in Supabase; application code never sees them.
- `SUPABASE_JWT_SECRET` — nothing outside Supabase mints or verifies JWTs, since authorization
  reads `profiles` (D-01).
- `OWNER_EMAIL` — the bootstrap address is set once via SQL into `app_settings`, not carried as an
  environment secret.
- `CRON_SECRET`, `EDGE_FUNCTION_SECRET`, `RESEND_WEBHOOK_SECRET`, `SENTRY_*` — the features are
  deferred (D-12, Appendix A).
- Tunable constants (bucket name, TTLs, size caps, import limits) — code constants or
  `app_settings`, not environment.

**Permanent.** No Google Drive credential, token, API key, or service account will ever appear in
this list. Its absence is the enforcement of the never-touch-Drive requirement.

---

## D-14 — Phase 0 has no authentication
**Date:** 2026-08-31 · **Status:** Accepted

**Decision.** Phase 0 delivers an unauthenticated shell and a branded but non-functional sign-in
page. Google authentication begins in Phase 1. Framework and runtime versions are chosen as
"current stable at implementation time" rather than pinned in planning documents.

**Why.** Blueprint V1's Phase 0 exit criterion was rendering an "authenticated shell", which is
impossible before authentication exists. Pinning a major version in a document written before
implementation guarantees the document is stale on day one.

**Consequences.** Design and layout can be reviewed before any auth work. The `/login` page is
built once in Phase 0 with full branding and wired up in Phase 1 without visual change.

---

## D-15 — `/login` is branded, not a bare button
**Date:** 2026-08-31 · **Status:** Accepted

**Decision.** `/login` carries Asset Bank branding, the Class Builder logo, "Sign in to Asset
Bank", the instruction to use the personally invited Google account, "Continue with Google", the
invitation-only notice, and a notice that Google Drive permissions are not requested.

**Why.** "The app opens directly to Google sign-in" means there is no public homepage and no
marketing funnel. Blueprint V1 read it as a literal instruction to render one button, which is
both unfriendly and unhelpful — the Drive notice in particular is a reassurance worth showing at
the exact moment a person is asked to grant access to their personal Google account.

**Consequences.** There is still no public or marketing homepage. `/login` remains the only
unauthenticated route besides `/callback`, `/no-access`, and `/suspended`.
