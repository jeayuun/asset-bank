# Asset Bank — Progress

**Last updated:** 2026-09-01

---

## Current state

| | |
|---|---|
| **Current phase** | Phase 9 — Batch import (**complete and verified**) |
| **Authorized to do** | Nothing further without approval — awaiting Phase 10 go-ahead |
| **Next approved task** | None yet. Awaiting approval to begin Phase 10 (Audit console and production readiness). |
| **Application code** | Phases 1–8 plus spreadsheet batch import (assets/characters/lessons) with dry-run validation, skip-row resolution, chunked atomic commit, and a completion notification reusing Phase 8's pipeline — all verified against a live local Supabase/Postgres instance, including a real end-to-end run (upload → dry-run report → skip a row → commit → lesson/character created → notification) as a signed-in Admin |
| **Repository** | `package.json`, `app/`, `components/`, `lib/`, `supabase/` (28 migrations + seed, applied and tested), `tests/` (unit, rls, e2e — all passing), CI workflow |

---

## Explicit authorization boundary

The owner has authorized, in addition to the documentation work below:

- Phase 0 exactly as scoped in `docs/BLUEPRINT.md` §12
- Phase 1 exactly as scoped in `docs/BLUEPRINT.md` §13
- Phase 2 (Curriculum and taxonomy) — derived from §5.2/§5.4/§6, since no dedicated §14-style
  scope section exists for it
- Phase 3 (Asset core) — derived from §5.3/§7/§8, same reasoning (see "Completed work" below)
- Phase 4 (Catalog and search) — derived from §11, no dedicated scope section, same reasoning
- Phase 5 (Characters, poses, and lesson assignment) — derived from §5.3/§6/§7, same reasoning
- Phase 6 (Favorites and collections) — derived from §5.5, same reasoning. Two items from the
  Blueprint's own §17 "Open decisions" were resolved with its stated default rather than blocked
  on — see the Phase 6 entry below and the new Open blockers row
- Phase 7 (Requests) — derived from §5.6/§9, same reasoning
- Phase 8 (Notifications) — derived from §5.7, docs/DECISIONS.md D-12, same reasoning. No
  "event catalogue" is defined anywhere in the docs — this session derived one (three
  request-workflow events) from what's actually notification-worthy in the app so far; see the
  Phase 8 entry below
- Phase 9 (Batch import) — derived from §10/§11, same reasoning. Trimmed the assets kind's
  spreadsheet columns and deferred inline taxonomy-term creation and an asset-update resolve path;
  see the Phase 9 entry below
- Installing Node.js, pnpm, and the Supabase CLI via Homebrew (asked and approved before Phase 0)
- Installing Docker Desktop (the owner's own action, not this session's)

The owner has **not** authorized:

- Phase 10 or any later phase
- Creating a real Google Cloud OAuth client (Google provider stays `enabled = false` in
  `supabase/config.toml` until one exists — see Open blockers)
- Starting a real (non-local) Supabase project
- Connecting external services for real (Resend, Vercel, etc.) — code is wired, no live account
  exists
- Deploying anything
- Committing or pushing on the owner's behalf

Do not begin Phase 10 without explicit approval. Approving one phase is not approval for the next.

---

## Completed work

### 2026-08-31 — Documentation structure established

**What changed.** Created the repository documentation set. No application code, no packages, no
external services, no repository initialization.

**Files created**

| File | Contents |
|---|---|
| `CLAUDE.md` | Permanent project instructions, session checklist, safety boundaries, architecture constraints, working practices, documentation contract |
| `docs/PRODUCT_SPEC.md` | Approved product requirements recorded in the owner's terms |
| `docs/BLUEPRINT.md` | Technical Blueprint Version 2 |
| `docs/DECISIONS.md` | 15 architectural decision records (D-01 through D-15) |
| `docs/PROGRESS.md` | This file |

**Verification performed.** Confirmed no pre-existing repository, no application files, and no git
repository before writing. Verified against Supabase documentation that the `Before User Created`
and `Custom Access Token` auth hooks are available on the Free and Pro plans, and that only the
MFA-verification and password-verification hooks are restricted to Teams and Enterprise. That
finding is recorded in `DECISIONS.md` D-03.

**Blockers.** See "Open blockers" below.

**Recommended next task.** Owner approval to begin Phase 0.

---

### 2026-08-31 — Phase 0: Foundations

**What changed.** Scaffolded the Next.js application per `docs/BLUEPRINT.md` §12. No auth, no
database tables, no business logic — exactly as scoped.

**Environment note.** Node.js, pnpm, and the Supabase CLI were not present on the machine and were
installed via Homebrew with the owner's explicit approval before scaffolding began. Docker is
**not** installed (it requires an interactive GUI install) — `supabase start` / `supabase db
reset` have not been run locally. `supabase/config.toml`, empty `migrations/`, and `seed.sql` are
in place and ready once Docker is available; CI runs them on GitHub Actions, which has Docker
preinstalled.

**Files created**

| Area | Contents |
|---|---|
| `app/` | Root layout, global styles/design tokens (light + dark), `/` redirects to `/login` (no public homepage, per product spec §2), `app/(public)/login/` branded non-functional sign-in page (D-15) |
| `components/` | `ui/button.tsx`, `brand/logo.tsx` (placeholder wordmark — real Class Builder logo not yet supplied, blocker #1) |
| `lib/` | `utils.ts` (`cn` helper), `env.ts` (Zod-validated env, not yet imported anywhere — nothing requires real credentials in Phase 0) |
| `supabase/` | `config.toml`, empty `migrations/`, placeholder `seed.sql` |
| `types/database.types.ts` | Placeholder shape; regenerated by `pnpm gen:types` once Phase 1 migrations land |
| `tests/` | `unit/`, `rls/` (Vitest, placeholder suites), `e2e/login.spec.ts` (Playwright smoke test) |
| `.github/workflows/ci.yml` | typecheck, lint, format check, unit+RLS tests, `supabase db reset`, build, Playwright smoke test |
| `eslint.config.mjs` | `no-restricted-imports` banning `googleapis`/`google-auth-library` and out-of-scope imports of `lib/supabase/service` |
| `.env.example`, `.prettierrc.json`, `.prettierignore`, `vitest.config.ts`, `playwright.config.ts`, `.claude/launch.json` | Tooling config |

**Verification performed.**

```
pnpm install        # clean
pnpm typecheck       # pass
pnpm lint            # pass
pnpm format:check    # pass
pnpm test            # 2/2 pass (unit + RLS placeholder)
pnpm build           # pass — routes: /, /_not-found, /login (all static)
```

Visually verified `/login` in both light and dark color schemes via a local dev server: branding,
disabled "Continue with Google" button, invitation-only notice, and the "no Drive permissions"
notice all render correctly.

**Deviation caught and corrected.** An initial `pnpm format` (Prettier) run was scoped to the
whole repo and reformatted `CLAUDE.md` and `docs/*.md`, which are outside Phase 0's file scope.
Reverted via `git checkout`, and `CLAUDE.md` / `docs/` were added to `.prettierignore` so this
cannot recur — those files are governed by the documentation contract in `CLAUDE.md` §8, not by
app formatting tooling.

**Unexpected repository state noted, not caused by this session.** An "Initial commit" and a
GitHub remote (`origin` → `jeayuun/asset-bank.git`) appeared in the repository partway through
this session. No hook or `.claude` config in the repo accounts for it; it was not made by this
session (no `git commit` or `git remote` command was run here). Flagged to the owner for
awareness; nothing has been pushed.

**Not done, deliberately.** `supabase start` / `supabase db reset` have not been run locally
(Docker not installed). No `git add`/`commit`/`push` performed by this session beyond what's
already noted above.

**Recommended next task.** Owner decides: (1) install Docker Desktop so local Supabase can start,
and (2) approve beginning Phase 1 (Auth, invitations, users, Owner) per `docs/BLUEPRINT.md` §13.

---

### 2026-08-31 — Phase 1: Auth, invitations, users, Owner — built and verified

**What changed.** Implemented the full Phase 1 scope from `docs/BLUEPRINT.md` §13: migrations,
RLS policies, the invitation gate, Owner protection, admin RPCs, the Google OAuth flow, and
`/super/invitations` / `/super/users`. Written in one sitting while Docker wasn't installed, then
**fully verified end to end once it was** — `supabase start` / `supabase db reset` applied all 11
migrations and seed.sql against a real local Postgres, and every test actually ran. This entry
supersedes the earlier same-day "built, not yet verified" state.

**Migrations** (`supabase/migrations/`, 11 files, applied cleanly) — enums; `key_stages`/`grades`;
`profiles`; `invitations`; `audit_log` (immutable — no INSERT/UPDATE/DELETE grant for anyone,
`SECURITY DEFINER`-only writes) + `app_settings`; `app.*` authorization helpers (`uid()`,
`profile()`, `is_active()`, `is_admin()`, `is_super()`); RLS policies for every table (`profiles`
deliberately exempt from `FORCE ROW LEVEL SECURITY`, per D-02); `app.handle_new_user()` invitation
gate + Owner bootstrap trigger on `auth.users`; Owner-protection + super-admin-grant-guard
triggers; generic `app.audit_trigger()` wired to `profiles`/`invitations`/`app_settings`;
`app.set_user_role` / `app.suspend_user` / `app.reactivate_user` / `app.grant_super_admin` /
`app.unrecognized_sign_ins` RPCs. `supabase/seed.sql` seeds KS1–3, Grades 1–8, and a local
development Owner through the real bootstrap trigger path — confirmed by querying the seeded
database directly (one `profiles` row, `is_owner = true`, `app_settings` empty because the
bootstrap setting self-disarmed as designed).

**Application** — `lib/supabase/{client,server,service}.ts`; `middleware.ts` (session refresh,
live-profile gating, `/super/*` role gating); `lib/auth/{permissions,guards,session,actions,invitations}.ts`;
`lib/validation/{invitations,users}.ts`; functional `/login` (real `signInWithOAuth`), `/callback`,
`/no-access`, `/suspended`; authenticated shell at `/` with a placeholder catalog
(`app/(app)/`); `/super/invitations` (create/resend/revoke + Resend email) and `/super/users`
(role change, suspend/reactivate, locked Owner row, unrecognized-sign-in-attempts section);
`emails/invitation.ts`; `scripts/bootstrap-owner.sql`, `scripts/grant-super-admin.sql`,
`scripts/check-owner.ts`. `lib/env.ts` split into `lib/env.ts` (server-only, all six vars) and
`lib/env.client.ts` (the two `NEXT_PUBLIC_` vars, safe to bundle into Client Components).

**Real bugs found and fixed during live verification** — none of these were visible from
typecheck/lint/build alone; all four needed an actual Postgres instance or browser to surface:

1. **`citext` not schema-qualified inside a `search_path = ''` function.** `app.write_audit()`
   declared a bare `citext` local variable; with `search_path` forced empty inside every
   `SECURITY DEFINER` function, that couldn't resolve. Fixed by installing the extension into
   `public` explicitly and qualifying the reference as `public.citext`.
2. **`authenticated` never got `USAGE` on schema `app`.** RLS policies still worked (the table
   owner resolves policy expressions once, at `CREATE POLICY` time — only `EXECUTE` matters after
   that), which is why this stayed hidden through several passing tests. But every *direct* RPC
   call — `app.suspend_user`, `app.set_user_role`, everything the actual Server Actions use —
   needs fresh name resolution, which needs schema `USAGE`. Without this grant, every admin action
   in the real app would have failed with "permission denied for schema app." Added
   `grant usage on schema app to authenticated;`.
3. **`lib/supabase/client.ts` (the browser client) imported the full `lib/env.ts`,** which also
   validates `SUPABASE_SERVICE_ROLE_KEY` and the Resend key. Since a Client Component
   (`GoogleSignInButton`) imports `client.ts`, that validation ran in the browser too, throwing
   because those server-only vars are correctly absent there — this broke `/login` outright,
   confirmed in the browser. No secret value was ever exposed (Next.js only inlines
   `NEXT_PUBLIC_` vars into client bundles), but it's exactly the kind of client/server boundary
   mixing CLAUDE.md §4 warns about. Fixed by the `lib/env.client.ts` split described above.
4. **Test-suite bugs, not app bugs** (`tests/rls/`): `withRole()` always rolls back its
   transaction, so a suspend-then-read-status test never saw its own write — restructured to
   read within the same transaction. Owner-fixture tests tried to create a *second* `is_owner`
   row, colliding with the one `seed.sql` already creates — rewritten to target the seeded
   Owner's known id instead of minting new ones. Hardcoded invitation emails collided across
   reruns — switched to unique per-test emails, and `afterEach` now deletes invitations
   referencing a test's fixture profiles before deleting the profiles themselves (the FK has no
   cascade).

**Deviation from the Blueprint, documented, not silent.** `docs/DECISIONS.md` D-16: dropped the
"suspension calls an admin API to revoke sessions" step from §4.4/§13. Verified via web search
that Supabase's Admin API has no supported "revoke all sessions for this user ID" call — only by
JWT, or by deleting the account outright, which D-05 forbids for a reversible state. The actual
security guarantee (RLS denies a suspended user regardless of token validity) doesn't depend on
this step; see D-16 for the full reasoning.

**Known follow-up, not fixed.** `next build` prints: `The "middleware" file convention is
deprecated. Please use "proxy" instead.` Next.js 16.1's migration path
(`middleware.ts` → `proxy.ts`) has a documented "logout loop" pitfall specific to Supabase auth
flows. Left as `middleware.ts` (still fully functional, deprecation warning only) rather than
migrating blind — revisit once there's a way to test the switch against a live auth flow, ideally
with a real Google OAuth client configured.

**Also noted, reverted, not caused by this session.** `next dev` (Next.js 16.2+) auto-injects a
managed `<!-- BEGIN:nextjs-agent-rules -->` block into `CLAUDE.md` on every run, upserting it back
in even after deletion unless the file (with the block) is committed. Reverted via `git checkout`
each time it appeared during this session's verification. **This will keep recurring** — every
`next dev` invocation, from anyone, re-adds it — so it needs an owner decision (accept and commit
it once, per Next.js's own docs, or find another way to suppress it), not something to keep
silently reverting indefinitely.

**Verification performed — for real this time, against a live local Postgres/Supabase instance.**

```
pnpm typecheck              # pass
pnpm lint                   # pass
pnpm format:check           # pass (docs/ and CLAUDE.md untouched)
supabase start               # all 11 migrations + seed.sql applied cleanly
pnpm test                    # 73/73 pass (55 unit + 18 RLS, all against the live database)
pnpm check:owner             # "Exactly one Owner exists."
pnpm build                   # pass, against the real local .env.local (Supabase's well-known
                              # local-dev demo keys — not a secret, same on every machine)
pnpm test:e2e                # 2/2 pass, against a live `pnpm dev` + the real local Supabase
```

Manually verified in a browser against the live stack: `/login` renders and the "Continue with
Google" button is enabled and actually initiates the OAuth flow — clicking it redirects to
Supabase's `/auth/v1/authorize` with the correct `redirect_to=http://localhost:3000/callback` and
a real PKCE `code_challenge`, and fails only with `"Unsupported provider: provider is not
enabled"`, which is the expected state before a real Google Cloud OAuth client is configured.
Unauthenticated access to `/super/users` correctly redirects to `/login`.

**Not done, deliberately.** No Google Cloud OAuth client created (external credential — see Open
blockers). No real email sent (`RESEND_API_KEY` is a placeholder locally). No `git
add`/`commit`/`push`.

**Recommended next task.** Owner approval to begin Phase 2 (Curriculum and taxonomy) per
`docs/BLUEPRINT.md` §13/§11. Separately, decide what to do about the recurring `CLAUDE.md`
auto-injection noted above.

---

### 2026-08-31 — Phase 2: Curriculum and taxonomy — built and verified

**What changed.** Terms, lessons (with the trigger-derived lesson code), and the taxonomy system
(taxonomies + taxonomy_terms, with merge/deactivate) per `docs/BLUEPRINT.md` §5.2/§5.4/§6. There
is no dedicated Phase 2 scope section in the Blueprint (only Phases 0 and 1 got one), so this
phase's scope was derived from the entity model and permission matrix directly.

**A real dependency ordering conflict, resolved by deferring, not by pulling Phase 3 forward.**
`taxonomy_asset_types` (which taxonomies apply to which asset types) and the reassignment step of
"merge" both need `asset_types` / `asset_taxonomy_terms`, which don't exist until Phase 3 (§5.3).
Rather than create a stub `asset_types` table now, both are deferred: `taxonomy_asset_types` moves
to a Phase 3 migration, and `app.merge_taxonomy_term()` deactivates the source and audits the
merge now, with the reassignment step added via `CREATE OR REPLACE FUNCTION` once
`asset_taxonomy_terms` exists. Nothing currently references taxonomy terms, so there is nothing to
reassign yet regardless.

**What was deliberately not seeded.** Only Gender's terms (Female, Male) — required and closed by
the product spec. The Blueprint's character-type list ("Student, Profession character, Indigenous
community character, PWD character") is explicitly framed as *examples*, not a required seed list,
so the other seven taxonomies start empty; a Super Admin adds real terms through `/super/taxonomy`.

**Migrations** (4 new files, 15 total) — `terms` + `lessons` with `app.set_lesson_code()` (verified
byte-for-byte against the Blueprint's own example, `M3T2L07`) and a guard trigger blocking
`grades.number` / `terms.number` changes while lessons reference the row; `taxonomies` +
`taxonomy_terms` with guards for slug immutability, system-taxonomy deactivation, and a
two-level hierarchy cap (generalized from the Blueprint's profession-specific description to any
`is_hierarchical` taxonomy); RLS for all four tables (`is_active()` read, curriculum writes at
`is_admin()`, taxonomy writes at `is_super()` — per the §4.6 policy table); `app.merge_taxonomy_term()`.

**A second real, more serious bug found by testing against a live instance: `app.*` RPCs were
unreachable from the actual app.** `supabase.rpc(...)` calls only reach the `public` schema by
default. Every `app.*` RPC — including all of Phase 1's `suspend_user`, `set_user_role`,
`reactivate_user`, `log_sign_in` — would have failed with a routing error the moment a real user
clicked anything, despite passing every RLS test, because those tests connect to Postgres directly
and never went through PostgREST. Fixed by adding `app` to `supabase/config.toml`'s exposed
`[api] schemas`, granting `authenticated` `USAGE` on it via PostgREST's `search_path`, and changing
every call site to `supabase.schema("app").rpc(...)`. Verified two ways: a real signed-in session
(created via the Auth Admin API, signed in with `signInWithPassword`, matching exactly what the
app's own callback flow produces) successfully calling `app.unrecognized_sign_ins()` over real
HTTP, and a `viewer` session getting a business-logic rejection ("only a Super Admin…") rather than
a routing error — proving the schema is reachable and the authorization check inside the function
is what's actually gating it. Both are now committed as `tests/rls/rpc-schema-exposure.test.ts` so
this bug class can't come back silently; `tests/rls/helpers.ts`'s direct-Postgres-connection tests
structurally cannot catch it.

**Also found while wiring the invitations flow to the real generated types:** `pnpm gen:types` was
finally run against the live database (Docker is available now), replacing the hand-written
Phase 1 placeholder types. The real `invitations.role` column type is the full `role_enum`
(`viewer | admin | super_admin`), not the narrower `viewer | admin` the CHECK constraint implies —
Postgres type generation doesn't see CHECK constraints. `resendInvitation` assumed the narrow type;
fixed by parsing through `invitationRoleSchema` before use, which both narrows the type and
double-checks the invariant at runtime.

**Application** — `lib/validation/{curriculum,taxonomy}.ts`; `/admin/curriculum` (lesson list
filtered by grade/term, create, deactivate/reactivate) with its own route group and layout —
Phase 2 is the first phase with `/admin/*` routes, so `middleware.ts` gained Admin-and-above
gating for that prefix, alongside the existing Super-Admin-only `/super/*` gating; `/super/taxonomy`
(list, per-taxonomy term management: add — disabled for closed taxonomies, rename, deactivate,
merge, with parent/group selection for the hierarchical `profession` taxonomy).

**Verification performed — against a live local Postgres/Supabase instance throughout, not
after the fact this time.**

```
pnpm typecheck                          # pass
pnpm lint                               # pass
pnpm format:check                       # pass (docs/ and CLAUDE.md untouched)
supabase db reset                        # all 15 migrations + seed applied cleanly
pnpm test                                # 90/90 pass (55 unit + 35 RLS/integration)
pnpm build                                # pass — routes include /admin/curriculum,
                                           # /super/taxonomy, /super/taxonomy/[taxonomyId]
```

Manually verified via `psql` before writing the committed test suite: the lesson code trigger
(`M3T2L07`, exact Blueprint match); every guard trigger rejecting exactly the case it's meant to
(grade-number change while referenced, three-level hierarchy, non-hierarchical taxonomy given a
parent, system-taxonomy slug change, system-taxonomy deactivation) — all five failed with the
correct, specific error on the first try.

**Update, same day: the browser click-through above was requested and done anyway — three more
real bugs found.** Rather than accept the OAuth gap, a *temporary* local-only route
(`app/(public)/dev-login/route.ts`, deleted before this entry was written) signed in via
`supabase.auth.signInWithPassword()` through the app's real server-side Supabase client, so it set
cookies exactly the way `/callback` does for real OAuth. Two throwaway test users (`super_admin`,
`admin`, both `@rls-test.local`, created via the Admin API) were used to click through both pages
for real. This surfaced three bugs that no automated test in this repo would have caught:

1. **Every table wrapper (`/admin/curriculum`, `/super/taxonomy`, and — carried over from
   Phase 1 — `/super/users`, `/super/invitations`, six locations total) used
   `overflow-hidden` instead of `overflow-x-auto`.** A table wider than its container had its
   trailing columns (status, action buttons) silently clipped and *unreachable* — confirmed by
   clicking where a "Deactivate" button should have been and hitting nothing. Fixed by changing
   `overflow-hidden` to `overflow-x-auto` on all six.
2. **That fix alone weren't quite enough — a second, deeper bug.** With the table now able to
   scroll, scrolling right moved the *entire page* horizontally instead of just the table,
   confirmed visually (the header and sidebar nav shifted off-screen too). Classic flexbox
   `min-width: auto` behavior: the `(admin)` and `(super)` layouts' content column
   (`<div className="flex-1">`) couldn't shrink below its content's natural width inside the
   `flex` row next to the sidebar nav, so the whole row grew instead of the table scrolling
   internally. Fixed by adding `min-w-0` to that column in both layouts. Re-verified: the table
   now scrolls independently (visible scrollbar on the table itself) while the page stays put —
   this is exactly the "page body must never scroll horizontally, wide content scrolls in its own
   container" rule.
3. **A missing React `key` on a shorthand `<>` fragment inside `.map()`** in the taxonomy detail
   page's hierarchical rendering (`app/(super)/super/taxonomy/[taxonomyId]/page.tsx`) — real,
   independent of the stale-console-history confusion that first surfaced it (see below). Fixed by
   using `<Fragment key={term.id}>` instead.

**A methodology note, in case it recurs.** Two apparent bugs during this pass turned out to be
stale console history from a browser tab that had been open since earlier in this session (a
`server-only`-in-client-component error from a bug fixed hours earlier, and one instance of the
key warning above) — confirmed by opening a fresh tab and seeing zero errors on the same page.
`read_console_messages` returns the tab's full accumulated history, not just messages since the
last navigation; a fresh tab is the reliable way to tell "is this current" from "is this history."

**Manually verified working, end to end, as real signed-in users:** creating a top-level taxonomy
term; creating a child term under a hierarchical taxonomy's group (Healthcare → Registered Nurse)
with the parent selector populated correctly; renaming a term, persisted across reload; merging
two terms (source → `Inactive` with a `Reactivate` control, dropped from future merge-dropdown
options, single `merge` audit row with the correct `merged_into` target); the closed `Gender`
taxonomy correctly hiding its "add term" form entirely; creating a lesson (`Girl student waving
KS1` → code `M1T1L05`, the exact product-spec example title); deactivating and reactivating a
lesson; middleware correctly gating `/admin/*` to Admin-and-above (a plain `admin` account reached
it; the header correctly hid the Super-Admin-only "Admin" link for that account); and — by
accident, from a mis-click during this session, not a planned test — confirmed that suspending an
account really does immediately eject it to `/suspended` on the next request.

**Re-verified after all three fixes:** `pnpm typecheck`, `pnpm lint`, `pnpm format:check`,
`pnpm test` (90/90), `pnpm check:owner`, `pnpm build`, `pnpm test:e2e` (2/2) — all against a freshly
reset local database. The temporary route, its middleware carve-out, and the throwaway test users
were all removed; `CLAUDE.md`'s Next.js auto-injection reappeared twice more during this pass and
was reverted both times.

**Not done, deliberately.** No Google Cloud OAuth client created. No `git add`/`commit`/`push`.

**Recommended next task.** Owner approval to begin Phase 3 (Asset core) per `docs/BLUEPRINT.md`
§5.3/§11 — this is also where the deferred `taxonomy_asset_types` table and the merge RPC's
reassignment step land.

---

### 2026-08-31 — Phase 3: Asset core — built and verified, including real file uploads

**What changed.** `asset_types`, `assets`, the asset join tables, the publish-precondition
trigger, and the private `asset-previews` Storage bucket per `docs/BLUEPRINT.md` §5.3/§7/§8. Also
landed the two items deferred from Phase 2: `taxonomy_asset_types` (needed `asset_types` to
exist) and the merge RPC's reassignment step (needed `asset_taxonomy_terms` to exist).

**Same dependency-deferral pattern as Phase 2, this time going the other direction.**
`character_profiles` is explicitly Phase 5's table (§11: "Characters, poses, and lesson
assignment"). `assets.character_profile_id` and the characters-specific publish precondition
("if type is Characters: character_profile_id set and a pose_action term assigned") are both
absent from this phase's `assets` table — they land via `alter table` + a trigger-function
`CREATE OR REPLACE` in a Phase 5 migration. In the interim, nothing stops creating an asset with
`asset_type = 'characters'`; that gap closes in Phase 5, not before.

**Migrations** (8 new files, 23 total) — `asset_types` (seeded: characters, objects-and-backgrounds,
math-tools, timers, template-tools; slug-immutable, system-type guard, matching the taxonomies
pattern); `taxonomy_asset_types` (deferred from Phase 2, now seeded with all 8 mappings);
`assets` (title/asset_type_id/status/review_state/preview fields/Drive URLs/primary_media/
search_text + generated `search_tsv`, `pg_trgm` + GIN indexes); the join tables
(`asset_key_stages`, `asset_grades`, `asset_lessons`, `asset_taxonomy_terms`, `tags`,
`asset_tags`); the publish-precondition trigger (`app.check_asset_publish_preconditions()` — only
checks the four preconditions that aren't *already* unconditionally guaranteed by column
constraints, to avoid dead code: Drive URL shape validation via `app.is_valid_drive_url()`,
`preview_path` present, at least one `asset_key_stages` row, `primary_media = video` requires
`drive_mp4_url`); RLS for every new table (`assets` grouped with `asset_types`/`taxonomies` in the
§4.6 policy table — asset type creation is Super-Admin-only, not Admin, matching §6); the
`asset-previews` bucket (private, 5MB, `image/png`/`image/jpeg`/`image/webp`) with storage.objects
policies; `app.merge_taxonomy_term()` extended via `CREATE OR REPLACE` to actually reassign
`asset_taxonomy_terms` from source to target.

**Application** — `lib/drive.ts` (URL parse + validate only, mirroring the DB-side check);
`lib/images.ts` (client-side `createImageBitmap` + canvas resize to WebP — display 1200px/q80,
thumb 400px/q75 — no image-transformation add-on, no server-side processing); `lib/validation/assets.ts`;
`app/(admin)/admin/assets/` (`page.tsx` list, `new/` create form, `[assetId]/edit/` detail with
preview upload and status actions) and its Server Actions (`createAsset`, `updateAsset`,
`requestPreviewUploadUrls`, `recordPreviewUpload`, `publishAsset`, `unpublishAsset`,
`archiveAsset`, `restoreAsset`). `middleware.ts` already gated `/admin/*` from Phase 2, so no
change needed there.

**Verified directly via `psql` before writing the committed test suite** (same discipline as
Phase 2): created a draft asset, then satisfied each publish precondition one at a time,
confirming each specific rejection message fires in order (missing `preview_path` → missing Key
Stage → non-Drive URL shape → video without `drive_mp4_url`), then a full successful publish
producing `search_text` containing the title.

**The real browser click-through this time included actual file uploads — the first genuinely new
technical surface since Phase 1 (canvas image resizing, Supabase Storage signed uploads).** Same
temporary local-only sign-in route as Phase 2 (deleted after), one throwaway `admin` test account.
The Claude Browser tooling here can't drive a native OS file picker, so the two halves were
verified separately, both for real: (1) the exact resize logic from `lib/images.ts`, executed live
in the browser's own JS console against a synthetic 2000×1500 canvas image — correctly produced a
1200×900 WebP display and a 400×300 WebP thumb, aspect ratio preserved; (2) the exact Storage
sequence the Server Actions perform (`createSignedUploadUrl` → `uploadToSignedUrl` →
record the path on the asset → `createSignedUrl` to read it back), via a Node script using a real
signed-in session — uploaded a real WebP blob, then fetched it back over HTTP and confirmed
`200` / `content-type: image/webp`. Reloading the edit page in the browser showed the actual
uploaded image rendering (`naturalWidth`/`naturalHeight` both 1, matching the test image, `complete:
true` — not a broken image icon). Then, as the real signed-in admin clicking through the UI: created
the asset end to end (title, Timers type, a Drive PNG link, one Key Stage) → the create form
correctly redirected to the edit page → Publish → Archive → Restore to draft, each transition
reflected correctly and immediately.

**Two more real bugs found and fixed during that pass:**

1. The "New asset" button on `/admin/assets` wrapped its text onto two lines and clipped inside
   its fixed-height container — confirmed visually, fixed with `whitespace-nowrap` and a proper
   flex layout.
2. (Verification-only, not a code bug) A stale `.next` route-type-validator cache referenced the
   deleted temporary `/dev-login` route after cleanup, briefly breaking `pnpm typecheck` and
   `pnpm build` — resolved by clearing `.next`, not a real regression. Noted here because it's the
   second time a stale-cache artifact has looked like a real bug this session (see Phase 2's
   stale-console-history note); recurring enough to flag as a pattern to check for first before
   chasing a fix.

**Verification performed.**

```
pnpm typecheck              # pass
pnpm lint                   # pass
pnpm format:check           # pass (docs/ and CLAUDE.md untouched)
supabase db reset             # all 23 migrations + seed applied cleanly
pnpm test                    # 105/105 pass (55 unit + 50 RLS/integration)
pnpm check:owner             # "Exactly one Owner exists."
pnpm build                   # pass — routes include /admin/assets, /admin/assets/new,
                              # /admin/assets/[assetId]/edit
pnpm test:e2e                # 2/2 pass
```

Plus the real-browser file-upload verification described above, which nothing in the automated
suite exercises (the RLS suite's Storage-adjacent coverage is limited to bucket config and grants,
not an actual upload/read cycle).

**Not done, deliberately.** No Google Cloud OAuth client created. No `git add`/`commit`/`push`.
`character_profiles`, `assets.character_profile_id`, and the characters publish precondition are
Phase 5's, not built here.

**Recommended next task.** Owner approval to begin Phase 4 (Catalog and search) per
`docs/BLUEPRINT.md` §11 — the first phase with a real Viewer-facing UI; everything built so far has
been Admin/Super-Admin tooling.

---

### 2026-08-31 — Phase 4: Catalog and search — built and verified, no new migrations

**What changed.** The real Viewer-facing catalog per `docs/BLUEPRINT.md` §11: full-text search,
asset-type and Key-Stage facet filters, grid/list view toggle, pagination, and an asset detail
page. This is the first phase with a genuine Viewer-facing UI — everything through Phase 3 was
Admin/Super-Admin tooling.

**No new migrations — a deliberate, verified absence, not an oversight.** Phase 3's `assets` RLS
already scopes a Viewer to `status = 'published'` rows only, and the `search_tsv` generated column
and its GIN index already exist from Phase 3. Phase 4 needed no schema change at all; it's purely
an application-layer read surface on top of what Phase 3 already secured. Confirmed by the test
suite below, which exercises exactly the query shapes the new pages use, directly against the
existing RLS policies.

**Application** — `app/(app)/page.tsx` rewritten from the Phase 1 placeholder to the real catalog:
search via `.textSearch("search_tsv", q, { type: "websearch" })`, an asset-type filter, a Key-Stage
facet filter (resolved as a separate `asset_key_stages` query first, then applied with `.in("id",
ids)` — kept out of the main `.select()` so that string stays static and typed rather than built
dynamically per active filter), grid/list toggle via `?view=`, pagination via `?page=`, and batch
signed thumbnail URLs via `createSignedUrls`. `app/(app)/assets/[assetId]/page.tsx` — new asset
detail page: title, description, asset type, an individually-signed preview image, Drive links as
`target="_blank"` anchors, and Key Stages/taxonomy terms/tags. `components/catalog/asset-card.tsx`
— `AssetCard` component with `grid`/`list` variants.

**Verification performed.**

```
pnpm typecheck                          # pass
pnpm lint                               # pass
pnpm format:check                       # pass (docs/ and CLAUDE.md untouched)
supabase db reset                        # all 23 migrations + seed applied cleanly
pnpm test                                # 111/111 pass (55 unit + 56 RLS/integration)
pnpm check:owner                         # "Exactly one Owner exists."
pnpm build                                # pass — routes include /, /assets/[assetId]
pnpm test:e2e                            # 2/2 pass
```

`tests/rls/phase4.test.ts` (6 tests): full-text search matching on both title and description
words; Key-Stage facet filtering; an archived asset staying invisible to a Viewer through both a
search query and a Key-Stage-filtered query that would otherwise match it; and confirming an Admin
*can* still see that same archived asset through the identical query shape — proving the boundary
is the RLS policy, not something coincidental in how the catalog builds its query.

**Real browser click-through as a signed-in Viewer** (same temporary local-only sign-in route
pattern as Phases 2–3, deleted after, plus one throwaway `viewer` test account and a handful of
sample assets inserted directly via `psql` for the walkthrough — never added to `seed.sql`):
searching by a title word and by a description-only word both correctly narrowed the grid; the
Key-Stage facet filter correctly narrowed results; the grid/list toggle rendered correctly in both
modes; opening an asset showed its signed preview image, description, and a working "Open PNG in
Google Drive" link that opened the real stored URL in a new tab; an archived asset was absent from
both the unfiltered catalog and the search results that would otherwise have matched it, and
navigating directly to its detail URL correctly 404'd for the Viewer.

**No real application bugs found this pass — a methodology false alarm instead, worth recording.**
Search initially appeared not to filter results when checked via an automated click sequence.
Root-caused in four steps: (1) confirmed the URL query params were submitted correctly, (2) ran the
identical Supabase query directly in a throwaway Node script and got the correct filtered result,
(3) fresh-navigated to the same URL directly and saw the correct filtered result, (4) redid the
original click flow with an explicit wait after submit and got the correct result. Conclusion: the
click-then-immediately-read test procedure was checking the page before client-side navigation had
finished, not a real bug — the app was correct throughout. Recorded here so the same false alarm
isn't rediscovered from scratch in a later phase.

**Not done, deliberately.** No Google Cloud OAuth client created. No `git add`/`commit`/`push`.
Favorites, collections, and the Requests workflow (Phases 6–7) are not part of this catalog.

**Recommended next task.** Owner approval to begin Phase 5 (Characters, poses, lesson assignment)
per `docs/BLUEPRINT.md` §11 — this is also where the two items deliberately deferred from Phase 3
(`assets.character_profile_id` and the characters-specific publish precondition) land.

---

### 2026-08-31 — Phase 5: Characters, poses, and lesson assignment — built and verified

**What changed.** `character_profiles`, the deferred `assets.character_profile_id` column and
characters-specific publish precondition, a character/pose picker on the asset forms, and a
grade→term→lesson assignment picker on the asset edit page, per `docs/BLUEPRINT.md`
§5.3/§6/§7/§11.

**Migration** (1 new file, 24 total) — `character_profiles` (grade required, `key_stage_id`
derived from `grade_id` by trigger — same "stored value can never drift from its source" pattern
as lesson codes, D-09; `character_type_term_id`/`gender_term_id`/`character_group_term_id` →
`taxonomy_terms`, all nullable — profession/wardrobe/pose_action are per-asset facets via
`asset_taxonomy_terms`, not profile columns, per the Blueprint's own field list; `cover_asset_id` →
`assets`; no uniqueness on `name`, per D-06); RLS (`is_active()` read / `is_admin()` write / no
delete grant, matching §4.6's table exactly); `alter table assets add column
character_profile_id`; the Phase 3 publish-precondition trigger extended via `create or replace
function` with precondition 6 (Characters type requires `character_profile_id` and a `pose_action`
term assigned in `asset_taxonomy_terms`); `app.set_asset_search_text()` extended the same way to
fold the linked character's name into `search_text` — flagged as a Phase 5 follow-up by the Phase 3
migration's own comment.

**Application** — `lib/validation/characters.ts`; `/admin/characters` (grade-filtered list,
create form with a non-blocking same-name-in-grade warning per D-06, deactivate/reactivate — no
delete, consistent with every other admin-managed table) and its Server Actions; a "Characters"
link added to the admin sidebar (a real gap found during verification — see below); the asset
create form gains a conditional character-profile picker shown only when the asset type is
Characters; the asset edit page gains a "Character & pose" section (character profile +
`pose_action` term, the latter stored via `asset_taxonomy_terms` since a pose is an asset-level
fact per §6.2, not a column) and a "Lesson usage" section — a grade→term→lesson checkbox picker
that writes `asset_lessons` and derives `asset_grades` from the distinct grades of whichever
lessons end up selected, rather than choosing grades directly; the asset detail page links to the
linked character's page when one is set; a new Viewer-facing `app/(app)/characters/[profileId]/`
page listing that profile's published poses (RLS already scopes this to published rows, no extra
filter needed).

**`asset_grades` and `asset_lessons` existed since Phase 3 but were never wired into any UI or
tested until now** — Phase 3 created both tables with full RLS as part of the join-tables
migration, anticipating this phase. `tests/rls/phase5.test.ts` adds their first RLS coverage
(visibility hidden for a draft asset, Admin-only write) alongside the new `character_profiles`
coverage.

**Verification performed.**

```
pnpm typecheck                          # pass
pnpm lint                               # pass
pnpm format:check                       # pass (docs/ and CLAUDE.md untouched)
supabase db reset                        # all 24 migrations + seed applied cleanly
pnpm test                                # 122/122 pass (55 unit + 67 RLS/integration)
pnpm check:owner                         # "Exactly one Owner exists."
pnpm build                                # pass — routes include /admin/characters,
                                           # /characters/[profileId]
pnpm test:e2e                            # 2/2 pass
```

Manually verified via `psql` before writing the committed test suite: `key_stage_id` correctly
derived from `grade_id` on insert; the extended publish trigger rejecting a Characters asset with
no `character_profile_id`, then rejecting one with a profile but no `pose_action` term, then
succeeding once both are set, with `search_text` confirmed to contain the character's name even
though the asset's own title didn't repeat it.

**Real browser click-through as a signed-in Admin (same temporary local-only sign-in route pattern
as Phases 2–3, deleted after) found two real bugs:**

1. **The admin sidebar never linked to the new `/admin/characters` page.** The route existed and
   worked, but nothing in the UI reached it except typing the URL directly — found immediately on
   first navigating there for real. Fixed by adding a "Characters" link to
   `app/(admin)/admin/layout.tsx`, alongside Assets and Curriculum.
2. **The asset detail page 404'd for every Characters-type asset, including a fully published
   one.** `assets` and `character_profiles` have *two* foreign keys between them —
   `assets.character_profile_id → character_profiles.id` (this phase's new column) and the
   pre-existing `character_profiles.cover_asset_id → assets.id` — so PostgREST's embed shorthand
   `character_profiles(id, name)` was ambiguous and returned a `PGRST201` error, which the page's
   `.maybeSingle()` call swallowed into a plain `null`, indistinguishable from "asset not found."
   Confirmed the exact cause with a direct `curl` against PostgREST (error response named both
   candidate relationships), then fixed by qualifying the embed with the specific FK name:
   `character_profiles!assets_character_profile_id_fkey(id, name)` in
   `app/(app)/assets/[assetId]/page.tsx`. Re-verified the same asset's detail page rendered
   correctly, including a working link to its character's profile page.

**Also manually verified working, end to end, as the real signed-in Admin:** creating two
identically-named "Mia" profiles in Grade 1 and seeing the correct non-blocking duplicate warning;
creating a Characters-type asset and assigning it a character profile at creation; the "Character &
pose" section correctly pre-populating the existing selection on reload; the publish button
surfacing the exact precondition-6 error message from the database trigger, in order, as the
missing pieces were filled in one at a time (`preview_path` → `character_profile_id` → a
`pose_action` term), then a successful publish; the grade→term→lesson picker showing a real seeded
lesson, saving it, and `asset_lessons`/derived `asset_grades` rows confirmed correct via `psql`;
the Viewer-facing `/characters/[profileId]` page correctly showing "Grade 1 · KS1" and the one
published pose grouped under it.

**A tooling-quirk note, not an app bug.** Several `computer` clicks at manually-estimated screenshot
coordinates missed their target silently (no navigation, no error, nothing in the network log) —
traced to a mismatch between the screenshot's displayed frame and the page's actual scroll
position after an intervening `scroll_to` call, not a coordinate-scaling issue (the dispatch frame
does match the screenshot's stated pixel size). `find` + ref-based clicks were reliable throughout;
raw coordinates from an older or partially-scrolled screenshot were not. Recorded here as the same
class of false alarm as Phase 2's stale-console-history note and Phase 4's premature-read note —
worth ruling out before concluding a click "did nothing."

**Not done, deliberately.** No Google Cloud OAuth client created. No `git add`/`commit`/`push`.
Favorites, collections, and the Requests workflow (Phases 6–7) are unaffected.

**Recommended next task.** Owner approval to begin Phase 6 (Favorites and collections) per
`docs/BLUEPRINT.md` §11.

---

### 2026-08-31 — Phase 6: Favorites and collections — built and verified

**What changed.** Favorites (per-Viewer, one asset ↔ one profile), personal and team-shared
collections with items and editing membership, per `docs/BLUEPRINT.md` §5.5/§11.

**Two of the Blueprint's own §17 "Open decisions" were resolved with its stated default, not
blocked on, and are flagged here for the owner to confirm or override:**

1. **Team-collection editing** (§17 item 2): owner + explicit editing members, with Super Admin
   override — the Blueprint's own documented assumption.
2. **Managing membership itself** (who is a member, who can edit) is scoped to the collection
   owner or a Super Admin — not an editing member. This isn't in the Blueprint at all; it's this
   session's inference, on the reasoning that letting any editing member add or remove other
   members (or grant themselves broader rights indirectly) is a materially different, more
   sensitive capability than editing the collection's contents, and nothing in the spec says
   editing members should have it.

**Migration** (1 new file, 25 total) — `favorites` (`profile_id`, `asset_id` composite PK);
`collections` (`name`/`description`/`owner_id`/`visibility` enum `personal`\|`team`); `collection_items`
(`collection_id`, `asset_id`, `position`); `collection_members` (`collection_id`, `profile_id`,
`can_edit`); RLS matching §4.6's table exactly for `favorites`/`collections`/`collection_items`
(`collection_members` isn't in that table — RLS follows the parent collection's visibility for
SELECT, owner/Super-Admin-only for every write, per decision 2 above); `app.can_edit_collection()`,
a `SECURITY DEFINER` helper centralizing "owner, editing member, or Super Admin" so it isn't
duplicated across five separate policies; `collections` gets an audit trigger, matching the
convention that only the named entity is audited, not its join tables.

**Two more `SECURITY DEFINER` RPCs, both discovered as real gaps during this phase, not
anticipated in the Blueprint.** `profiles` SELECT is `id = uid() OR is_admin()` (§4.6) — correct
for the rest of the app, but it directly blocks the two things this phase needs: a non-admin
collection owner resolving an email to a profile id to add a member, and later displaying that
member's email in the UI. `app.find_profile_id_by_email()` (exact match only, no partial search,
no name — minimal disclosure) and `app.collection_member_emails()` (scoped to exactly the
visibility collections' own SELECT policy already grants the caller, so it can never disclose a
membership the caller couldn't already see the collection for) close both gaps without widening
`profiles` RLS itself.

**Application** — `lib/validation/personalization.ts`; `app/(app)/actions.ts` (`toggleFavorite`,
shared between the catalog and asset detail page); `app/(app)/collections/` (index with a create
form and My/Team-shared sections, `[collectionId]/` detail with items grid, delete, and member
management, and their Server Actions); `components/catalog/favorite-button.tsx` (wired into
`AssetCard` and the asset detail page) and `add-to-collection.tsx` (checkbox list of the viewer's
editable collections, on the asset detail page); `components/collections/` (create form, member
management, remove-item and delete-collection buttons); "Favorites" and "Collections" links added
to `AppHeader`. `components/catalog/asset-card.tsx`'s `CatalogAsset` interface gained
`isFavorited`, threaded through from the catalog page, the character-profile pose page, and the
new favorites/collection pages.

**Verification performed.**

```
pnpm typecheck                          # pass
pnpm lint                               # pass
pnpm format:check                       # pass (docs/ and CLAUDE.md untouched)
supabase db reset                        # all 25 migrations + seed applied cleanly
pnpm test                                # 134/134 pass (55 unit + 79 RLS/integration)
pnpm check:owner                         # "Exactly one Owner exists."
pnpm build                                # pass — routes include /favorites, /collections,
                                           # /collections/[collectionId]
pnpm test:e2e                            # 2/2 pass
```

`tests/rls/phase6.test.ts` (12 tests): favorites scoped to `profile_id = uid()` for select/insert,
denying favoriting on another user's behalf; a personal collection hidden from everyone but its
owner and a Super Admin, a team collection visible to any active Viewer, collection creation
denied for anyone but the row's own `owner_id`; `app.can_edit_collection()` returning the correct
answer for an owner, a stranger, an editing member, and a view-only member; `collection_items`
writes denied to a non-member and allowed to an editing member; an archived asset dropping
silently from a collection's Viewer-visible contents while the underlying row stays untouched
(D-11, verified the same way Phase 4 verified it for the catalog); `collection_members` writes
denied to an editing member and allowed to the owner; both new RPCs resolving a real active email
and returning null for one with no account.

**Real browser click-through as two separate signed-in Viewers (same temporary local-only
sign-in-route pattern as prior phases, deleted after; two throwaway `viewer` accounts, to actually
exercise cross-account team-collection membership) found one real bug.**

The admin sidebar gap from Phase 5 has a sibling here, avoided by design rather than found by
accident this time — `AppHeader` (used by every Viewer-and-above page) had no way to reach
`/favorites` or `/collections` at all until this phase added the links; confirmed both worked on
first navigation, so no bug there. The real one: **a collection's member list displayed "unknown"
instead of the member's email**, for exactly the `profiles` RLS reason described above — this was
caught live in the browser (Viewer A added Viewer B as a member and saw "unknown · can edit"
instead of Viewer B's address), root-caused to the same `id = uid() OR is_admin()` policy that had
already been worked around for the email-lookup half of this feature but not yet for the display
half. Fixed by `app.collection_member_emails()` (described above) and re-verified: the member list
correctly showed `phase6-viewer-b@rls-test.local · can edit` after the fix.

**Also manually verified working, end to end, as real signed-in users:** favoriting an asset from
the catalog grid (heart fills immediately, no page reload) and seeing it appear on `/favorites`;
creating a team-shared collection; adding a second Viewer as an editing member by email; adding an
asset to that collection from the asset's own detail page via the checkbox-style "Add to
collection" control; signing in as the editing member (not the owner) and confirming the
member-management section and "Delete collection" button were correctly absent for them, while the
per-item "Remove" control was correctly present (matching `app.can_edit_collection()`'s intended
scope) — removing the item as that second-account editing member and confirming it actually
persisted; deleting the collection as the owner, with a working two-step confirm control, and
confirming the row and its cascaded `collection_members` row were both gone afterward.

**A tooling-quirk false alarm, same class as Phase 5's.** A `Remove`-button click that appeared to
do nothing (no error, no network request, no server log) was root-caused by directly testing the
identical DELETE via `psql` with the real user's session context — which succeeded immediately,
proving the RLS policy was correct and the click itself simply missed its target. A retry from a
fresh screenshot's coordinates worked on the first try. Recorded here, alongside Phase 5's version
of the same note, since it's now happened in two consecutive phases and is worth checking first
before chasing what looks like a permissions bug.

**Not done, deliberately.** No Google Cloud OAuth client created. No `git add`/`commit`/`push`.
Renaming a collection after creation isn't built — the exit criteria and product spec don't call
for it, only create/add-remove-items/membership. The Requests workflow (Phase 7) is unaffected.

**Recommended next task.** Owner approval to begin Phase 7 (Requests) per `docs/BLUEPRINT.md` §11
— and separately, the owner's confirmation (or override) of the two Open-decision defaults used in
this phase, listed above and in Open blockers below.

---

### 2026-09-01 — Phase 7: Requests — built and verified

**What changed.** The full asset-request workflow per `docs/BLUEPRINT.md` §5.6/§9 and
`docs/DECISIONS.md` D-10: `asset_requests` with an auto-generated `REQ-####` reference and an
8-state transition matrix (`submitted → under_review → approved → in_progress → completed`, with
`on_hold`/`rejected`/`cancelled` branches and Admin-only reopening from any closed state) enforced
entirely in the database; comments, deliverables, and watchers; requests private by default
(visible only to the requester, watchers, and Admin+); an Admin status board at `/admin/requests`.

**Migration** (1 new file, 26 total) — `asset_requests` (`reference` trigger-derived from a
dedicated sequence, same "stored value can never drift" pattern as lesson codes and request-code
predecessors, D-09); `request_comments` (soft-delete via `deleted_at`, no hard delete anywhere in
this schema); `request_deliverables` (asset link or raw Drive URL, at least one required);
`request_status_history`; `request_watchers`; `app.can_see_request()` — a `SECURITY DEFINER`
helper (D-10 requires this specifically to avoid a policy cycle between `asset_requests` and
`request_watchers`, each needing to reference the other for visibility); two auto-watch triggers
(the requester on request creation, a commenter on comment); `app.change_request_status()` and
`app.assign_request()` — RPCs enforcing the transition matrix, the per-status requirement (a note
for `rejected`/`on_hold`, an existing assignee for `in_progress`, at least one deliverable for
`completed`), and the actor check (Admin+, or the requester cancelling their own
`submitted`/`under_review` request), writing `request_status_history` atomically; RLS for all five
tables matching §4.6 (`status`/`assigned_to`/`closed_at`/`closed_reason` deliberately excluded from
`asset_requests`' direct UPDATE grant — they change only through the two RPCs above, same reasoning
as `profiles.role`/`status`/`is_owner`); the generic audit trigger wired to `asset_requests`, per
§5.8's own list.

**Two more scoped `SECURITY DEFINER` RPCs, anticipated proactively this time rather than found as
bugs** — having already hit this exact `profiles` RLS wall twice in Phase 6
(`app.find_profile_id_by_email`, `app.collection_member_emails`), the same gap was predictable
here: a non-admin requester or watcher needs to see who else is on a request, but can't read
`profiles` for anyone but themselves. `app.request_participant_emails()` resolves emails for a
request's requester, assignee, comment authors, and watchers, scoped to exactly what
`app.can_see_request()` already grants the caller. The existing `app.find_profile_id_by_email()`
(Phase 6) is reused as-is for "add a watcher by email."

**Application** — `lib/validation/requests.ts`; `app/(app)/requests/actions.ts`
(`createRequest`, `changeRequestStatus`, `assignRequest`, `addComment`/`editComment`/
`deleteComment`, `addDeliverable`, `addWatcherByEmail`/`removeWatcher`); `app/(app)/requests/`
(index with a create form and a list of own+watched requests, `[requestId]/` detail page with
role-conditional Admin controls layered onto the same page rather than a separate admin-only
detail view); `app/(admin)/admin/requests/` (a status-grouped board with filters for status,
assignee, priority, Key Stage, grade, and overdue `needed_by`, per §9's own description of that
page); `components/requests/` (status-transition buttons, assign control, comment thread with
inline edit/soft-delete, deliverable list with an attach form, watcher list with add-by-email);
"Requests" links added to `AppHeader` and the admin sidebar.

**Three real bugs found by the RLS test suite, before ever touching a browser — all three would
have broken every single request submission through the real app, since they all sit in the one
code path (`createRequest`) that every Viewer must use:**

1. **The two auto-watch triggers weren't `SECURITY DEFINER`.** The migration's own comment
   asserted "a plain trigger... bypasses RLS," which is simply wrong — an ordinary trigger function
   executes with the *calling* role's privileges, not the table owner's; only `SECURITY DEFINER`
   runs as the owner. Without it, a Viewer's own request or comment insert failed outright with
   "new row violates row-level security policy for table request_watchers," because
   `request_watchers`' own INSERT policy is Admin+ only for direct writes. A superuser-based manual
   `psql` spot check earlier in this phase didn't catch it — a superuser session bypasses RLS
   regardless, which is exactly why the automated suite's `withRole()`-driven tests (real
   `authenticated`-role sessions) are what actually exercises this path. Fixed by adding
   `security definer` to both trigger functions.
2. **`nextval()` on the reference sequence had no grant for `authenticated`.** Sequences need
   explicit `USAGE`, unlike table `SELECT`, which is implied by nothing else the role already had —
   every request submission failed with "permission denied for sequence request_reference_seq."
   Fixed with `grant usage on sequence app.request_reference_seq to authenticated;`.
3. **The deepest one: `INSERT ... RETURNING` on `asset_requests` failed with a spurious RLS error,
   even after both fixes above.** Postgres checks a `RETURNING` row against the table's SELECT
   policy using a snapshot taken at the *start* of the statement — so `app.can_see_request()`'s
   self-referential "is this my own request" lookup against `asset_requests` can't see the row it's
   being asked to check, because that row didn't exist yet when the statement's snapshot was taken.
   Confirmed via direct `psql`: the identical insert succeeds with a plain `INSERT`, fails only when
   `RETURNING` is added, and a `STABLE`-vs-`VOLATILE` A/B test on the function ruled out volatility
   as the cause — it's specifically about the RETURNING-clause SELECT-policy check, not the
   function. Fixed by generating the row's `id` client-side and never using `RETURNING` on this one
   insert (`createRequest`, `app/(app)/requests/actions.ts`) — this is the only table in the schema
   whose SELECT policy is self-referential in this exact way, so no other insert path needed the
   same treatment. All three fixes are covered by dedicated assertions in `tests/rls/phase7.test.ts`
   so this bug class can't come back silently.

**Verification performed.**

```
pnpm typecheck                          # pass
pnpm lint                               # pass
pnpm format:check                       # pass (docs/ and CLAUDE.md untouched)
supabase db reset                        # all 26 migrations + seed applied cleanly
pnpm test                                # 150/150 pass (55 unit + 95 RLS/integration)
pnpm check:owner                         # "Exactly one Owner exists."
pnpm build                                # pass — routes include /requests, /requests/[requestId],
                                           # /admin/requests
pnpm test:e2e                            # 2/2 pass
```

`tests/rls/phase7.test.ts` (16 tests): reference format and auto-watch on creation; requests hidden
from a stranger but visible to the requester, a watcher, and an Admin (D-10); the full transition
matrix — Admin-only forward transitions, requester-or-Admin cancellation, the `assigned_to`
precondition for `in_progress`, the note requirement for `rejected`, the deliverable requirement for
`completed`, and a rejected illegal jump; `app.assign_request()` refusing a Viewer as assignee and
refusing a Viewer as actor; comment visibility, auto-watch-on-comment, and author-or-Admin edit
rights (including confirming that RLS's `UPDATE` policy silently no-ops an unauthorized attempt
rather than throwing — a real Postgres RLS semantic this session's tests initially got wrong, since
it differs from `INSERT`'s `WITH CHECK` failure and from a trigger's explicit `RAISE`, both of which
do throw); deliverable and watcher write permissions; both new RPCs.

**Real browser click-through, driving a single request through its entire lifecycle as two
separate signed-in users (same temporary local-only sign-in-route pattern as prior phases, deleted
after; one throwaway `viewer` and one throwaway `admin` account):** submitted a request as the
Viewer (`REQ-0054` — the jump from `REQ-0001` is expected, not a bug: Postgres sequences are never
rolled back, so this session's many `psql` debug inserts during the RETURNING investigation above
had already consumed reference numbers even though those transactions were rolled back); posted a
comment and confirmed the author's email resolved correctly via `app.request_participant_emails()`;
switched to the Admin and drove the request `submitted → under_review → approved` (each transition
via a real button click); attempted `in_progress` before assigning and saw the exact
"assign the request before moving it to in_progress" error surface in the UI; assigned the request
to the Admin and retried successfully; attempted `completed` with no deliverable and saw
"completing a request requires at least one deliverable"; attached one and completed successfully;
confirmed the only next action offered on a closed request was "Move to Under review" (reopen).

**A tooling-quirk note, distinct from prior phases'.** Several clicks on the "Submit request" /
status-transition buttons appeared to do nothing (no navigation, no network request, no server
error) despite using `find`-sourced element refs — traced not to a coordinate-scaling issue (ref
clicks and manually-measured `getBoundingClientRect()` coordinates agreed) but to some other
click-reliability gap between a `computer` screenshot call and a later, separate `computer` click
call. Wrapping the screenshot and the click in one `browser_batch` call — so they share the same
captured frame atomically — made every subsequent click land reliably for the rest of this
session's walkthrough. Worth trying first if a click silently does nothing again.

**Not done, deliberately.** No Google Cloud OAuth client created. No `git add`/`commit`/`push`. No
title-only duplicate-request search (D-10 explicitly defers it to a future phase). Notifications
(Phase 8) — nothing here sends an email or in-app notification yet; watchers exist, but nothing
notifies them.

**Recommended next task.** Owner approval to begin Phase 8 (Notifications) per
`docs/BLUEPRINT.md` §11 — the natural next phase, since requests and watchers now exist but nothing
notifies anyone of anything yet.

---

### 2026-09-01 — Phase 8: Notifications — built and verified

**What changed.** In-app notifications with a polling bell, per-type in-app/email preferences, and
Resend email sent directly from Server Actions with failures caught, audited, and surfaced in the
UI — per `docs/BLUEPRINT.md` §5.7 and `docs/DECISIONS.md` D-12.

**No "event catalogue" is defined anywhere in the docs, so this session derived one from what's
actually notification-worthy in the app so far: `request_status_changed`, `request_assigned`, and
`request_comment`** — the three watcher/assignee-facing moments in the one multi-actor feature
built to date (Phase 7). `notification_type` is additive, so later phases (e.g. Phase 9's own
"notify the uploader" for batch import) can add values without disruption.

**Migration** (1 new file, 27 total) — `notifications` and `notification_preferences` per the
Blueprint's schema, plus `email_status`/`email_error` columns not in that literal schema but
required to satisfy D-12's explicit "a failure is logged to audit_log and surfaced in the UI"
requirement, which the bare schema can't do alone; `app.notify()`, the single write path for every
notification row, respecting the `in_app` preference (an absent preference row defaults both
booleans true — opt-out, not opt-in) by skipping row creation entirely when it's off; three
trigger functions wiring `app.notify()` to the existing `asset_requests`/`request_comments` tables
from Phase 7 (status-change and assignment on `asset_requests`, new-comment on
`request_comments`); RLS matching §4.6 (`notifications` has a genuine user-facing DELETE grant —
the one place in the whole schema where "no hard delete" doesn't apply, since dismissing your own
notification isn't touching business data); two more RPCs for the email-delivery half, described
below.

**Two more real bugs found — both would have silently broken every cross-user notification email
in the app, the second one found by code review before ever running a test:**

1. **The two auto-watch-style trigger functions weren't `SECURITY DEFINER`.** Same exact mistake
   as Phase 7's auto-watch triggers, on a fresh pair of functions this phase added — a plain
   trigger function still executes with the calling role's privileges, not the table owner's.
   Caught immediately by the RLS test suite (`app.notify()` failing with "permission denied for
   function notify" the moment a real `authenticated` session tried to use it), before any
   browser use — the same lesson from Phase 7 evidently hadn't fully generalized on the first
   attempt. Fixed by adding `security definer` to both.
2. **The deeper one, caught by re-reading the design before writing tests, not by a failing
   test:** `sendPendingNotificationEmails()`'s first step queried `notifications` directly through
   the *caller's own* Supabase client — but the caller is always the *actor* (whoever changed a
   status, commented, assigned), and the actual recipients (watchers, an assignee) are almost
   always someone else. `notifications` SELECT is `recipient_id = uid()`, so that query would
   always return zero rows for exactly the notifications that needed emailing, regardless of
   whether the trigger worked. Confirmed directly: as the actor, `app.notify()` returns a real new
   id (proving the row exists), while a plain `select * from notifications` in that same session
   sees nothing. Fixed by replacing the two-step lookup (an RLS-scoped table query, then a
   by-id RPC) with one `SECURITY DEFINER` RPC, `app.pending_notification_emails_for_entity()`,
   scoped to `(entity_type, entity_id, since)` rather than caller identity — the caller already has
   legitimate access to that entity (every event originates from an action requiring
   `app.can_see_request()` first), so this discloses nothing the caller couldn't already reach.
   This also simplified `lib/notifications/send.ts` from two round-trips to one.

**Application** — `lib/validation/notifications.ts`; `lib/notifications/send.ts`
(`sendPendingNotificationEmails()`, called from `changeRequestStatus`, `assignRequest`, and
`addComment` in `app/(app)/requests/actions.ts` — correlated by `(entityType, entityId, since)`
rather than having the Phase-7 RPCs return notification ids directly, since migrations are
forward-only and that would have meant dropping an already-shipped function); `emails/notification.ts`
(one generic template, matching `emails/invitation.ts`'s plain-text-plus-minimal-HTML style);
`app/(app)/notifications/` (list with mark-read/mark-all-read/dismiss, and a preferences panel) and
its Server Actions; `components/shell/notification-bell.tsx` (client-side poll every 30s, per
§5.7's "lightweight poll on the bell component" — no Realtime, no websocket) wired into
`AppHeader`, which is now itself an async Server Component fetching the initial unread count.

**Verification performed.**

```
pnpm typecheck                          # pass
pnpm lint                               # pass
pnpm format:check                       # pass (docs/ and CLAUDE.md untouched)
supabase db reset                        # all 27 migrations + seed applied cleanly
pnpm test                                # 161/161 pass (55 unit + 106 RLS/integration)
pnpm check:owner                         # "Exactly one Owner exists."
pnpm build                                # pass — routes include /notifications
pnpm test:e2e                            # 2/2 pass
```

`tests/rls/phase8.test.ts` (11 tests): status-change and comment fan-out notifying watchers but
excluding the actor; assignment notifying the assignee even on self-assignment; a requester
cancelling their own request generating no self-notification; the `in_app` preference suppressing
row creation entirely, contrasted against the opt-out default when no preference row exists;
`notifications` RLS (recipient-only select, no direct insert, `read_at`-only update grant, and the
one genuine user-facing delete in the schema); `notification_preferences` RLS; and
`app.pending_notification_emails_for_entity()` itself, proving the exact cross-recipient read the
bug above required. Getting these tests to actually prove what they claimed took two more rounds of
fixes distinct from the app-layer bugs above — recorded here since the pattern is worth naming
precisely, not just "tests were flaky":

- The familiar `withRole()`-always-rolls-back class, again, in three tests that mutated in one
  call and checked in a separate one.
- A `beforeAll()`-shared fixture in one describe block that a **different, file-level `afterEach`**
  quietly destroyed: `createdUserIds` is drained after *every* test, not once at the end of the
  block, and `notifications.recipient_id` is `ON DELETE CASCADE` — so the shared notification row
  was gone by the second test in that block. Fixed by creating fixtures per-test instead.
- The most interesting one: after fixing the `withRole()` rollback pattern, three tests *still*
  failed with "expected a notification, got none" — even though `app.notify()` provably succeeded
  (it returned a real id). The tests were querying `notifications` as the *actor* (e.g., the admin
  who changed the status), whose session is correctly RLS-scoped to see only their *own*
  notifications — which, in these scenarios, don't exist, since the recipient is someone else. This
  is the exact same bug as production issue #2 above, reappearing inside the test itself; the fix
  was the same too — read through `app.pending_notification_emails_for_entity()` instead of a
  plain table query.

**Real end-to-end verification as two signed-in users (same temporary local-only sign-in-route
pattern as prior phases, deleted after; one throwaway `viewer` and one throwaway `admin` account),
run against the real (placeholder-keyed) local Resend configuration rather than mocked:** submitted
a request as the Viewer; moved it to "Under review" as the Admin; confirmed in Postgres that a
`request_status_changed` notification was created for the Viewer (not the Admin), that Resend was
actually called and failed with `"API key is invalid"` (the expected outcome of a real local
placeholder key — this is the *right* verification, not a workaround, since it proves the failure
path end-to-end rather than assuming success), and that the failure was written to `audit_log` per
D-12. Switched back to the Viewer: the bell showed the correct unread badge on first server-rendered
load; `/notifications` showed the notification with "notification email failed (API key is
invalid)" surfaced inline, exactly as D-12 requires; clicking the notification's title navigated to
the request *and* marked it read, confirmed both in the UI (badge cleared) and directly in Postgres
(`read_at` set).

**Not done, deliberately.** No Google Cloud OAuth client created. No `git add`/`commit`/`push`. No
real Resend account exists to verify an actual successful send — only the (equally important,
D-12-required) failure path was exercised for real; a successful send is exactly the same code path
minus the `catch`, so this isn't a meaningful gap, but it's worth naming rather than implying more
than was tested. No notification types beyond the three request-workflow ones — Phase 9's import
notification and any future asset-publishing notifications are additive work for those phases, not
this one.

**Recommended next task.** Owner approval to begin Phase 9 (Batch import) per
`docs/BLUEPRINT.md` §10/§11 — the last of the originally-scoped phases before Phase 10's audit
console and production-readiness work.

---

### 2026-09-01 — Phase 9: Batch import — built and verified

**What changed.** Spreadsheet batch import for assets, characters, and lessons, per
`docs/BLUEPRINT.md` §10: upload → parse → normalize → validate → dry-run report → resolve (skip a
row) → commit (chunked, atomic per chunk) → result notification. Every imported row lands as a
`draft` — imports never publish, never create taxonomy terms, and never touch Google Drive.

**Deliberately trimmed from the Blueprint's fuller §10 description, stated to the owner before
building:** the assets kind's spreadsheet columns are narrower than a full asset record (title,
description, asset type, Key Stages, Drive URLs, primary media only — no taxonomy terms, lesson
assignment, tags, or character-profile linkage via spreadsheet; those stay editable through the
existing single-asset edit form once the row lands as a draft); no inline creation of missing
taxonomy terms during import (a row referencing a term that doesn't exist is invalid, not
auto-created); no resolve path for updating an existing asset via import, only creating new ones;
no downloadable annotated-error file, only the in-app dry-run report; the column template is
generated on demand by a route handler rather than a stored file.

**Migration** (1 new file, 28 total) — `import_kind` and two status enums; `import_batches` and
`import_rows` tables (`raw`/`normalized`/`errors` as `jsonb`, matching the schema's existing
pattern for semi-structured data); `app.commit_import_rows(batch_id, row_ids)`, a `SECURITY
DEFINER` RPC that is the single write path from a validated row into `assets`/`character_profiles`/
`lessons` — the same chunked-atomic-RPC pattern used for every other multi-row/multi-table
operation in this codebase, since supabase-js has no client-side multi-statement transaction
primitive; `app.finish_import_batch(batch_id)`, which closes out a batch as `committed` or `failed`
and stamps `committed_at`; an additive `notification_type` value, `import_completed`, plus a
trigger firing `app.notify()` on that transition so the uploader is told when their batch finishes
— reusing Phase 8's notification pipeline rather than building a second one; RLS matching §4.6
(admin-only select/insert/update on both tables, no delete grant on either — batches and rows are
never removed, matching §4.4's "no hard delete" outside `import_batches`/`import_rows` scope,
which the Blueprint explicitly excludes from deletion entirely).

**One real bug found, caught by direct `psql` testing against a live `authenticated` session
before any test was written — the established practice from every prior phase:**
`app.finish_import_batch()`'s `UPDATE ... SET status = CASE WHEN v_failed_count = 0 THEN
'committed' ELSE 'failed' END` failed, because an untyped `CASE` over text literals defaults to
`text`, which Postgres does not implicitly cast to the `import_batch_status` enum on assignment.
Fixed by appending an explicit `::public.import_batch_status` cast to the `CASE` expression.

**The recurring `withRole()`-always-rolls-back test bug, again** — the same class already fixed in
every phase's test suite this session (1, 2, 3, 5, 6, 7, 8) — in two `tests/rls/phase9.test.ts`
tests that called `app.commit_import_rows` inside one `withRole()` and tried to verify the
resulting `character_profiles`/`lessons` row from a separate, later call. `withRole()` always rolls
back on exit, so the row never existed for the second call to see. Fixed by combining the RPC call
and its verification query into a single `withRole()` invocation, as in every prior fix of this
same pattern.

**Application** — `lib/import/kinds.ts` (per-kind column definitions, one source of truth shared by
parsing, validation, and the template download so they can't drift from each other);
`lib/import/parse.ts` (SheetJS `xlsx`, per `docs/BLUEPRINT.md` §10); `lib/import/normalize.ts`;
`lib/import/validate.ts` (per-kind structural, referential, and duplicate validation — including
D-06's existing rule that character-profile name collisions are a non-blocking warning, not an
error, applied identically during import); `lib/validation/imports.ts`;
`app/(admin)/admin/imports/actions.ts` (`uploadImportBatch`, `commitImportBatch`,
`setImportRowSkipped`, each `requireRole("admin")`-gated); `app/(admin)/admin/imports/page.tsx` and
`[batchId]/page.tsx`; `app/(admin)/admin/imports/template/[kind]/route.ts` (on-demand XLSX template
with a "Valid values" sheet queried live from the taxonomy tables, so it can't go stale);
`components/imports/` (`upload-form`, `import-row-list`, `commit-button`); an "Imports" link added
to the admin sidebar nav.

**Verification performed.**

```
pnpm typecheck                          # pass
pnpm lint                               # pass
pnpm format:check                       # pass (docs/ and CLAUDE.md untouched)
supabase db reset                        # all 28 migrations + seed applied cleanly
pnpm test                                # 171/171 pass (55 unit + 116 RLS/integration)
pnpm check:owner                         # "Exactly one Owner exists."
pnpm build                                # pass — routes include /admin/imports and /admin/imports/[batchId]
pnpm test:e2e                            # 2/2 pass
```

`tests/rls/phase9.test.ts` (10 tests): `app.commit_import_rows` denying a Viewer; committing a
valid assets row as a draft with its Key Stage correctly linked; committing a valid characters row
with `key_stage_id` correctly derived from the row's grade; committing a valid lessons row with a
correctly derived code (`M2T3L09`); leaving a skipped row untouched; `app.finish_import_batch`
denying a Viewer and marking the batch committed for an Admin; notifying the uploader once the
batch finishes (read through `app.pending_notification_emails_for_entity`, the Phase 8 RPC, rather
than a plain table query — applying that phase's own lesson directly); `import_batches`/
`import_rows` RLS (hidden from a Viewer, visible to an Admin; insert denied for a Viewer, allowed
for an Admin's own upload; no delete path for anyone).

**Real end-to-end verification as a signed-in Admin (same temporary local-only sign-in-route
pattern as prior phases, deleted after; one throwaway admin account):** uploaded a two-row lessons
spreadsheet (one valid Grade 3/Term 2/Lesson 12 "Fractions intro" row, one invalid Grade 99 row) —
the dry-run report correctly showed 1 valid/1 invalid with the cell-level error "grade: Grade 99 is
not 1-8"; committed the valid row and confirmed in Postgres that the lesson was created with the
correctly derived code `M3T2L12`, the batch transitioned to `committed`, and the `import_completed`
notification fired for the uploader — confirmed both directly in Postgres and in the `/notifications`
UI. Separately uploaded a two-row characters spreadsheet (both valid), unchecked the "Include"
toggle on one row, confirmed the commit button's label updated live to "Commit 1 row as drafts",
committed, and confirmed in Postgres that only the included character profile was created while the
unchecked row stayed `skipped` and was never written. The assets kind was not driven through the
browser this session — its commit/validation logic is exercised identically to the other two kinds
by the RPC-level `psql` testing and the committed test suite above, so this is a coverage gap in
manual UI clicking only, not in verification depth.

**Testing-methodology note, not an application bug:** the browser tooling's accessibility-tree
element references (`ref_N`) resolved to stale click coordinates for a few elements this session
(a submit button, a checkbox) — clicking by `ref` silently landed on the wrong point and did
nothing, while the identical element clicked by its current on-screen coordinate, or actuated
directly via `element.click()`/`form.requestSubmit()` in the page's own JS context, worked
correctly every time and was confirmed against the live DOM state and the database. Also: a native
`<input type="file">`'s `.value` cannot be set programmatically (browser security restriction, the
same limitation recorded in Phase 3's entry) — worked around with the standard `DataTransfer` API
technique, fetching the test file from the dev server's own `public/` directory into the page
context rather than hand-transcribing it as a base64 literal, after an initial manual-transcription
attempt produced a corrupted file and a genuine (if uninteresting) "Unsupported ZIP file" error.

**Not done, deliberately.** No `git add`/`commit`/`push`. Assets kind not manually clicked through
the browser (see above). No annotated-error-file download. No inline taxonomy-term creation during
import.

**Recommended next task.** Owner approval to begin Phase 10 (Audit console and production
readiness) per `docs/BLUEPRINT.md` §11 — the final originally-scoped phase.

---

## Phase status

| # | Phase | Status |
|---|---|---|
| 0 | Foundations (no auth) | **Complete** — see 2026-08-31 entry above |
| 1 | Auth, invitations, users, Owner | **Complete and verified** — see 2026-08-31 entry above |
| 2 | Curriculum and taxonomy | **Complete and verified** — see 2026-08-31 entry above |
| 3 | Asset core | **Complete and verified** — see 2026-08-31 entry above |
| 4 | Catalog and search | **Complete and verified** — see 2026-08-31 entry above |
| 5 | Characters, poses, lesson assignment | **Complete and verified** — see 2026-08-31 entry above |
| 6 | Favorites and collections | **Complete and verified** — see 2026-08-31 entry above |
| 7 | Requests | **Complete and verified** — see 2026-09-01 entry above |
| 8 | Notifications | **Complete and verified** — see 2026-09-01 entry above |
| 9 | Batch import | **Complete and verified** — see 2026-09-01 entry above |
| 10 | Audit console and production readiness | Not started — awaiting approval |

Phase scopes are defined in `docs/BLUEPRINT.md` §11, §12 (Phase 0), and §13 (Phase 1).

---

## Open blockers

These need an answer from the owner. Items 1 and 2 block Phase 0 work; the rest block Phase 1 or
later.

| # | Blocker | Blocks | Needed from |
|---|---|---|---|
| 1 | Class Builder logo files, brand colour values, typeface and any licence | Phase 0 shipped with a placeholder wordmark and neutral palette (`components/brand/logo.tsx`, `app/globals.css`); swap in real assets whenever supplied | Owner |
| 2 | Confirmation of the profession taxonomy model (single hierarchical taxonomy recommended) | Phase 2 schema; harmless to defer past Phase 0 | Owner |
| 3 | Sending domain or subdomain for Resend, plus who can add SPF, DKIM, DMARC DNS records | Phase 1 invitation email and Phase 8 notification email both being usable for real (both verified to fail correctly with a placeholder key; neither has ever sent a real email) | Owner + whoever controls DNS |
| 4 | Invitation expiry window — 14 days proposed | Phase 1 | Owner |
| 5 | Team-collection editing rule — owner + explicit members, or any active user. **Built with the Blueprint's own default** (owner + members, Super Admin override) in Phase 6; confirm or override | Phase 6, shipped with the default | Owner |
| 6 | Viewer-side request list scope — own + watched only, or everything for Admins. **Built with the RLS-driven default** in Phase 7: `/requests` runs one unfiltered query for every role, so an Admin sees every request there too (identical to `/admin/requests`), not just own + watched; confirm or override | Phase 7, shipped with the default | Owner |
| 7 | Invited user count, to determine whether the Google OAuth consent screen needs publishing | Phase 10 configuration only; not a technical blocker | Owner |
| 8 | Collection-membership management scope — owner/Super-Admin only (this session's inference in Phase 6, not in the Blueprint) vs. letting any editing member manage membership too | Phase 6, shipped with the narrower default | Owner |
| 9 | Notification event catalogue — no such list exists anywhere in the docs. **Built with a derived set** in Phase 8: `request_status_changed`, `request_assigned`, `request_comment` (the three watcher/assignee-facing moments in the request workflow). Additive — later phases can add types without disruption — but confirm this is the right starting set | Phase 8, shipped with the derived set | Owner |

---

## Verification log

| Date | Phase | Commands | Result |
|---|---|---|---|
| 2026-08-31 | 0 | `pnpm typecheck`, `pnpm lint`, `pnpm format:check`, `pnpm test`, `pnpm build` | All pass (before Docker was available). |
| 2026-08-31 | 1 | `supabase start`, `supabase db reset`, `pnpm test` (73/73), `pnpm check:owner`, `pnpm build`, `pnpm test:e2e` (2/2), manual browser check | All pass, against a real local Postgres/Supabase instance. Four real bugs found and fixed in the process — see the Phase 1 entry above. |
| 2026-08-31 | 2 | `supabase db reset`, `pnpm test` (90/90), `pnpm build`, manual `psql` trigger checks | All pass, against a real local Postgres/Supabase instance throughout. Two more real bugs found and fixed — see the Phase 2 entry above. |
| 2026-08-31 | 2 | Real browser click-through as signed-in admin/super_admin (temporary local-only sign-in route, deleted after), then full re-verification (typecheck/lint/format/`pnpm test` 90/90/`pnpm check:owner`/`pnpm build`/`pnpm test:e2e` 2/2) | All pass. Three more real bugs found and fixed (table overflow clipping, page-level horizontal scroll, missing React key) — see the Phase 2 entry above. |
| 2026-08-31 | 3 | `supabase db reset`, `pnpm test` (105/105), manual `psql` precondition checks, browser click-through including real file uploads (client-side resize verified live in-browser, full Storage upload/record/read cycle verified via a real signed-in session), full re-verification (typecheck/lint/format/`pnpm check:owner`/`pnpm build`/`pnpm test:e2e` 2/2) | All pass. One more real bug found and fixed (button text clipping) — see the Phase 3 entry above. |
| 2026-08-31 | 4 | `supabase db reset`, `pnpm test` (111/111), browser click-through as a signed-in Viewer (search, Key-Stage facet filter, grid/list toggle, asset detail page, archived-asset invisibility), full re-verification (typecheck/lint/format/`pnpm check:owner`/`pnpm build`/`pnpm test:e2e` 2/2) | All pass. No real application bugs found — one testing-methodology false alarm on search, root-caused and recorded — see the Phase 4 entry above. |
| 2026-08-31 | 5 | `supabase db reset`, `pnpm test` (122/122), manual `psql` trigger checks, browser click-through as a signed-in Admin (duplicate character profiles, character/pose assignment, publish preconditions in order, lesson assignment, Viewer character page), full re-verification (typecheck/lint/format/`pnpm check:owner`/`pnpm build`/`pnpm test:e2e` 2/2) | All pass. Two real bugs found and fixed (missing "Characters" sidebar link, ambiguous PostgREST embed 404ing the asset detail page) — see the Phase 5 entry above. |
| 2026-08-31 | 6 | `supabase db reset`, `pnpm test` (134/134), manual `psql` RLS/RPC checks, browser click-through as two separate signed-in Viewers (favoriting, team collection creation, cross-account membership, add/remove items, delete), full re-verification (typecheck/lint/format/`pnpm check:owner`/`pnpm build`/`pnpm test:e2e` 2/2) | All pass. One real bug found and fixed (a collection's member emails displaying as "unknown" due to `profiles` RLS, fixed with a scoped RPC) — see the Phase 6 entry above. |
| 2026-09-01 | 7 | `supabase db reset`, `pnpm test` (150/150 — 3 real bugs caught by the test suite itself before any browser use), manual `psql` transition-matrix and RETURNING-snapshot debugging, browser click-through of a full request lifecycle as a signed-in Viewer then Admin, full re-verification (typecheck/lint/format/`pnpm check:owner`/`pnpm build`/`pnpm test:e2e` 2/2) | All pass. Three real bugs found and fixed, all in the `createRequest` path (missing `SECURITY DEFINER` on auto-watch triggers, missing sequence `USAGE` grant, an `INSERT...RETURNING` snapshot-timing conflict with a self-referential RLS policy) — see the Phase 7 entry above. |
| 2026-09-01 | 8 | `supabase db reset`, `pnpm test` (161/161), manual `psql` cross-recipient RLS debugging, real end-to-end run (request → status change → email attempt → failure recorded and audited → UI) as two signed-in users against the real local Resend config, full re-verification (typecheck/lint/format/`pnpm check:owner`/`pnpm build`/`pnpm test:e2e` 2/2) | All pass. Two real bugs found and fixed (missing `SECURITY DEFINER` on the new trigger functions, caught by the test suite before any browser use; and a design flaw where the email-sending helper queried `notifications` through the actor's own RLS-scoped session instead of the recipient's, caught by re-reading the design before writing tests) — see the Phase 8 entry above. |
| 2026-09-01 | 9 | `supabase db reset`, `pnpm test` (171/171), manual `psql` enum-cast debugging, real end-to-end run (upload → dry-run report → skip a row → commit → lesson/character created with a correctly derived code/key stage → notification) as a signed-in Admin for both the lessons and characters kinds, full re-verification (typecheck/lint/format/`pnpm check:owner`/`pnpm build`/`pnpm test:e2e` 2/2) | All pass. One real bug found and fixed (an untyped `CASE` expression not implicitly casting to the `import_batch_status` enum, caught by direct `psql` testing before any test was written) — see the Phase 9 entry above. |

Standing verification commands, available from Phase 0 onward:

```
pnpm typecheck
pnpm lint
pnpm format:check
pnpm test            # Vitest unit tests
supabase db reset    # migrations + seed against the local stack
pnpm test:rls        # RLS policy suite (from Phase 1)
pnpm check:owner     # asserts exactly one Owner (from Phase 1)
pnpm test:e2e        # Playwright
```

---

## Exceptional operations log

Any manual database operation performed outside the application — Owner bootstrap, Owner recovery,
Super Admin promotion, or permanent record removal — is recorded here with the date, the operator,
the exact statements run, and the reason.

*No entries.*
