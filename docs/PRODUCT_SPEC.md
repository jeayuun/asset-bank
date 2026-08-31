# Asset Bank — Product Specification

**Status:** Approved
**Last updated:** 2026-08-31

This document records the approved product requirements. It is the owner's intent. Where it
conflicts with `BLUEPRINT.md`, this document wins and the blueprint is corrected.

---

## 1. Purpose

Asset Bank is an internal web application for the GBF Class Builder Visual Design team. It
organizes visual assets used in lesson slides.

Original PNG, EPS, and MP4 files **remain in Google Drive**. The application stores:

- Searchable metadata
- Uploaded static preview images
- Links to the original files in Google Drive

**The application must never modify, move, rename, or delete files in Google Drive.**

---

## 2. Authentication

- The app opens directly to Google sign-in. **There is no public or marketing homepage.**
- Users sign in with **individually invited personal Google accounts**.
- There is **no company Google Workspace domain**.
- Request only `openid`, `email`, and `profile`.
- **Do not request Google Drive API access.**
- The verified Google email must match an active invitation.

### 2.1 Sign-in screen

"Directly to sign-in" does **not** mean a bare button. `/login` may contain:

- Asset Bank branding
- Class Builder logo
- "Sign in to Asset Bank"
- A short instruction to use the personally invited Google account
- "Continue with Google"
- An invitation-only notice
- A notice that Google Drive permissions are not requested

### 2.2 Account states

Two separate concepts:

- **Invitation states:** `pending`, `accepted`, `revoked`, `expired`
- **Profile states:** `active`, `suspended`

A person who is only invited does **not** yet have a profile record. The user-management
interface may still display "Invited" as a status by reading the invitation record.

---

## 3. Roles

### Viewer

- Browse all published assets
- Search, filter, and preview assets
- Open the original Google Drive download links
- Create favorites
- Use personal and team-shared collections
- Submit and follow asset requests
- See every Key Stage but default to their assigned Key Stage

### Admin

Everything a Viewer can do, plus:

- Upload and edit assets
- Manage grades, terms, lessons, and asset lesson usage
- Review drafts
- Publish and archive assets
- Perform spreadsheet batch imports
- Manage asset requests, assignments, statuses, comments, and finished links

### Super Admin

Everything an Admin can do, plus:

- Invite, suspend, and reactivate users
- Assign Viewer and Admin roles
- Manage editable categories and taxonomy
- Access security settings and audit logs
- Manage protected application configuration

### Owner

The initial Super Admin is a protected Owner.

- The Owner **cannot be demoted, suspended, or removed** through ordinary user management.
- There is **one** protected Owner. A second protected Owner is not created automatically.
- Account loss is handled by a documented manual recovery process.
- **Super Admin must not appear as an ordinary role-dropdown option.** The selector offers Viewer
  and Admin only.
- Creating another Super Admin requires a separate protected manual process.

---

## 4. Organization structure

- **KS1:** Grades 1–3
- **KS2:** Grades 4–6
- **KS3:** Grades 7–8
- **Terms:** 1–3
- Approximately **40 lessons per term**

Users can see every Key Stage but default to their assigned Key Stage. **Assets may belong to
multiple Key Stages.**

### Lesson code

`M<grade>T<term>L<two-digit lesson>` — for example, `M3T2L07`.

---

## 5. Assets

Main asset types initially:

- Characters
- Objects and backgrounds
- Math tools
- Timers
- Template tools
- Other Super Admin-created categories

Each asset may provide:

- An uploaded preview image
- A Google Drive PNG link (for images)
- A Google Drive EPS link (for Adobe Illustrator)
- A Google Drive MP4 link (for videos)

**MP4 assets use an uploaded screenshot as their preview.** Do not embed, process, or
automatically generate video previews.

### 5.1 Lifecycle

`Draft` → `Published` → `Archived`. Only published assets appear in the normal Viewer catalog.

**There is no hard delete in the application.** Assets move only among these three states.
Archived assets retain their metadata, previews, lesson usage, favorites, collections, request
relationships, and audit history.

The same conservative approach applies to curriculum and taxonomy records: **deactivate or archive
referenced records instead of deleting them.**

### 5.2 Archived-item behavior (first version)

- Viewers **cannot** read archived asset metadata.
- Favorite and collection **relationships remain stored**.
- Archived assets **disappear** from Viewer catalog results and from Viewer collections.
- If restored to Published, they **automatically reappear**.
- Admins and Super Admins can view archived assets.

### 5.3 Titles

Asset names must be descriptive and searchable, such as "Girl student waving KS1". Do not rely
only on a character's proper name.

**There is no minimum word count.** These are all valid titles:

- Blue timer
- Philippine flag
- Girl student waving KS1

The requirement is a non-empty title with a reasonable length limit. The interface **may warn**
when a title appears vague or consists only of a character's proper name, but it must **not
reject** every title with fewer than three words. Publishing validation requires a meaningful
non-empty title, not an arbitrary word count.

---

## 6. Character organization

Character classification uses **independent editable facets**, not one large subcategory list:

- Character profile
- Character group
- Character type
- Profession group
- Profession
- Wardrobe or uniform
- Pose or action
- Gender: **Female or Male** (closed set)
- Key Stage
- Grade

Examples of character types: Student, Profession character, Indigenous community character, PWD
character, and other Super Admin-created types.

**Do not include "Visual attributes" or "Display language."**

### 6.1 Character identity

- Every character profile has its own **UUID**.
- Every character profile **requires a grade**.
- Grade 1 Mia and Grade 3 Mia are naturally separate because they have different profile IDs and
  different grades.
- **If two Grade 1 characters are both called Mia, the database must allow them.** Character names
  are labels, not identities.
- An optional unique internal `profile_code` is available if administrators need reliable
  human-readable identification.
- Use **duplicate warnings in the UI** instead of blocking profiles based on name and grade.

### 6.2 Poses

Different poses are grouped under the appropriate grade-specific character profile while remaining
**individual asset entries**. Each pose is a separate asset connected to exactly one
grade-specific character profile.

---

## 7. Lesson usage

An asset can be used in **multiple lessons**.

The lesson assignment interface follows this order:

1. Select a grade
2. Select Term 1, 2, or 3
3. Select one or more lessons

Admins and Super Admins maintain the lesson records.

Assets that are not tied to lessons must still be assigned to **one or more Key Stages**.

---

## 8. Asset requests

### 8.1 Visibility (first version)

- Viewers see requests **they created or are explicitly watching**.
- Admins and Super Admins see **all** requests.
- Request participants can see the relevant comments and updates.
- A future limited request-title search may be considered for duplicate prevention, but it must
  **not expose private descriptions or comments**.

### 8.2 Workflow

Request assignments, statuses, comments, and finished-asset links are managed by Admins and Super
Admins.

---

## 9. Feature list

- Search bar
- Searchable descriptive metadata
- Filterable asset catalog
- Grid and list views
- Asset details
- Character profiles with grouped poses
- Single asset upload
- Spreadsheet batch import
- Publishing queue
- Favorites
- Personal collections
- Team-shared collections
- Curriculum management
- Asset request workflow
- Request assignments, statuses, comments, and finished-asset links
- In-app notifications
- Email notifications
- User management
- Editable taxonomy management
- Security and audit history

---

## 10. Scope discipline for the first version

The first working version must be **practical, not maximal**. The database stays extensible, but
the following are deferred until their corresponding features are actually implemented, and the
initial Asset Bank must not depend on them:

- Partitioned audit tables
- Audit-log export and archival
- Realtime notifications
- Email digests
- Resend webhooks and bounce processing
- Sentry
- Point-in-time recovery
- Automated storage exports
- Companion ZIP preview imports
- Advanced scheduled cleanup jobs
- Production monitoring and restore drills

These are recorded as later production improvements in `BLUEPRINT.md` Appendix A.

---

## 11. Accepted technology direction

Next.js, TypeScript, Supabase (PostgreSQL, Auth, Storage, RLS), Vercel, and Resend.

Use the **current stable supported versions** of Next.js and Node.js at implementation time. Do
not pin an older major version in planning documents.

The Google OAuth test-user limit is a **deployment configuration note, not a technical blocker**.
The number of invited users will be confirmed before Google OAuth is configured.

---

## 12. Non-negotiable requirements

These may not be removed or altered without an explicit written change to this document:

- Personal Google-account invitations
- Viewer, Admin, Super Admin, and protected Owner boundaries
- No Google Drive API
- Uploaded static previews
- Screenshot previews for MP4 assets
- Original PNG, EPS, and MP4 links stored as text
- Grades 1–8
- Terms 1–3
- KS1, KS2, and KS3 mappings
- Multiple Key Stages per asset
- Multiple lesson assignments
- Editable categories controlled by Super Admin
- Grade-specific character profiles
- Separate pose asset entries
- Female/Male gender facet
- Draft, Published, and Archived states
- Search, filters, favorites, collections, requests, imports, and notifications
- No public homepage
