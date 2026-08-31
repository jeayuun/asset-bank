# Asset Bank — Progress

**Last updated:** 2026-08-31

---

## Current state

| | |
|---|---|
| **Current phase** | Pre-Phase 0 — documentation only |
| **Authorized to do** | Create and maintain documentation. Nothing else. |
| **Next approved task** | None. Awaiting approval to begin Phase 0. |
| **Application code** | None exists |
| **Repository** | Documentation only — no `package.json`, no source, no migrations |

---

## Explicit authorization boundary

The owner has authorized **only**:

- Creating the documentation structure
- Saving Blueprint Version 2
- Saving the approved product requirements
- Recording the development phases
- Preparing the repository for future Claude Code sessions

The owner has **not** authorized:

- Scaffolding the Next.js application
- Installing packages
- Creating application source code
- Starting Supabase
- Running migrations
- Configuring Google OAuth
- Connecting external services
- Deploying anything

Do not begin Phase 0 without explicit approval. Approving the blueprint is not approving the build.

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

## Phase status

| # | Phase | Status |
|---|---|---|
| 0 | Foundations (no auth) | Not started — awaiting approval |
| 1 | Auth, invitations, users, Owner | Not started |
| 2 | Curriculum and taxonomy | Not started |
| 3 | Asset core | Not started |
| 4 | Catalog and search | Not started |
| 5 | Characters, poses, lesson assignment | Not started |
| 6 | Favorites and collections | Not started |
| 7 | Requests | Not started |
| 8 | Notifications | Not started |
| 9 | Batch import | Not started |
| 10 | Audit console and production readiness | Not started |

Phase scopes are defined in `docs/BLUEPRINT.md` §11, §12 (Phase 0), and §13 (Phase 1).

---

## Open blockers

These need an answer from the owner. Items 1 and 2 block Phase 0 work; the rest block Phase 1 or
later.

| # | Blocker | Blocks | Needed from |
|---|---|---|---|
| 1 | Class Builder logo files, brand colour values, typeface and any licence | Phase 0 branded sign-in page | Owner |
| 2 | Confirmation of the profession taxonomy model (single hierarchical taxonomy recommended) | Phase 2 schema; harmless to defer past Phase 0 | Owner |
| 3 | Sending domain or subdomain for Resend, plus who can add SPF, DKIM, DMARC DNS records | Phase 1 invitation email being usable | Owner + whoever controls DNS |
| 4 | Invitation expiry window — 14 days proposed | Phase 1 | Owner |
| 5 | Team-collection editing rule — owner + explicit members, or any active user | Phase 6 | Owner |
| 6 | Viewer-side request list scope — own + watched only, or everything for Admins | Phase 7 | Owner |
| 7 | Invited user count, to determine whether the Google OAuth consent screen needs publishing | Phase 10 configuration only; not a technical blocker | Owner |

---

## Verification log

No test runs yet. Once Phase 0 lands, every entry here records the commands run and their results.

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
