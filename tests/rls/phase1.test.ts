import { afterEach, describe, expect, it } from "vitest";

import {
  asSuperuser,
  createAuthUserRow,
  createFixtureProfile,
  createOrphanAuthUser,
  deleteFixtureProfile,
  type FixtureProfile,
  withRole,
} from "./helpers";

/**
 * Exercises the RLS policies and triggers from the Phase 1 migrations
 * directly against Postgres (docs/BLUEPRINT.md §13 "Tests"). Run against a
 * local `supabase start` / `supabase db reset` stack via `pnpm test:rls`.
 */

const createdUserIds: string[] = [];

async function fixture(
  role: "viewer" | "admin" | "super_admin",
  opts?: { status?: "active" | "suspended"; isOwner?: boolean },
): Promise<FixtureProfile> {
  const profile = await createFixtureProfile(role, opts);
  createdUserIds.push(profile.userId);
  return profile;
}

async function orphan(): Promise<FixtureProfile> {
  const profile = await createOrphanAuthUser();
  createdUserIds.push(profile.userId);
  return profile;
}

// supabase/seed.sql seeds exactly one Owner through the real bootstrap
// trigger path. The profiles_single_owner unique index means no test can
// create a *second* is_owner fixture — Owner-protection tests target this
// seeded row directly instead.
const SEEDED_OWNER_ID = "00000000-0000-0000-0000-000000000001";

afterEach(async () => {
  // Invitations reference profiles via invited_by (NOT NULL, no cascade)
  // and accepted_profile_id — both must go before the profiles they point
  // at, or the profile delete fails on the FK.
  if (createdUserIds.length > 0) {
    await asSuperuser((client) =>
      client.query(
        "delete from public.invitations where invited_by = any($1::uuid[]) or accepted_profile_id = any($1::uuid[])",
        [createdUserIds],
      ),
    );
  }

  while (createdUserIds.length > 0) {
    const id = createdUserIds.pop();
    if (id) await deleteFixtureProfile(id);
  }
});

describe("profiles and invitations visibility", () => {
  it("denies a Viewer from reading invitations", async () => {
    const viewer = await fixture("viewer");
    const superAdmin = await fixture("super_admin");
    const email = `pending-${crypto.randomUUID()}@rls-test.local`;

    await asSuperuser((client) =>
      client.query(
        `insert into public.invitations (email, role, invited_by, expires_at)
         values ($1, 'viewer', $2, now() + interval '14 days')`,
        [email, superAdmin.userId],
      ),
    );

    const rows = await withRole(viewer.userId, (client) =>
      client.query("select * from public.invitations"),
    );
    expect(rows.rowCount).toBe(0);
  });

  it("lets a Super Admin read invitations", async () => {
    const superAdmin = await fixture("super_admin");
    const email = `pending-${crypto.randomUUID()}@rls-test.local`;

    await asSuperuser((client) =>
      client.query(
        `insert into public.invitations (email, role, invited_by, expires_at)
         values ($1, 'viewer', $2, now() + interval '14 days')`,
        [email, superAdmin.userId],
      ),
    );

    const rows = await withRole(superAdmin.userId, (client) =>
      client.query("select * from public.invitations where email = $1", [
        email,
      ]),
    );
    expect(rows.rowCount).toBe(1);
  });
});

describe("audit_log", () => {
  it("denies a Viewer from reading audit_log", async () => {
    const viewer = await fixture("viewer");
    const rows = await withRole(viewer.userId, (client) =>
      client.query("select * from public.audit_log"),
    );
    expect(rows.rowCount).toBe(0);
  });

  it("refuses UPDATE and DELETE on audit_log for any authenticated role, including Super Admin", async () => {
    const superAdmin = await fixture("super_admin");

    await expect(
      withRole(superAdmin.userId, (client) =>
        client.query(
          "update public.audit_log set action = 'tampered' where true",
        ),
      ),
    ).rejects.toThrow();

    await expect(
      withRole(superAdmin.userId, (client) =>
        client.query("delete from public.audit_log where true"),
      ),
    ).rejects.toThrow();
  });
});

describe("suspended and profile-less sessions", () => {
  it("denies a suspended profile access to is_active()-gated tables", async () => {
    const suspended = await fixture("admin", { status: "suspended" });
    const rows = await withRole(suspended.userId, (client) =>
      client.query("select * from public.key_stages"),
    );
    expect(rows.rowCount).toBe(0);
  });

  it("denies a session with no profile row access to is_active()-gated tables", async () => {
    const noProfile = await orphan();
    const rows = await withRole(noProfile.userId, (client) =>
      client.query("select * from public.key_stages"),
    );
    expect(rows.rowCount).toBe(0);
  });
});

describe("privilege escalation guards", () => {
  it("refuses an Admin calling app.set_user_role (Super Admin only)", async () => {
    const admin = await fixture("admin");
    const target = await fixture("viewer");

    await expect(
      withRole(admin.userId, (client) =>
        client.query("select app.set_user_role($1, 'admin')", [target.userId]),
      ),
    ).rejects.toThrow();
  });

  it("refuses a Super Admin suspending the Owner", async () => {
    const superAdmin = await fixture("super_admin");

    await expect(
      withRole(superAdmin.userId, (client) =>
        client.query("select app.suspend_user($1)", [SEEDED_OWNER_ID]),
      ),
    ).rejects.toThrow();
  });

  it("refuses a Super Admin changing the Owner's role", async () => {
    const superAdmin = await fixture("super_admin");

    await expect(
      withRole(superAdmin.userId, (client) =>
        client.query("select app.set_user_role($1, 'viewer')", [
          SEEDED_OWNER_ID,
        ]),
      ),
    ).rejects.toThrow();
  });

  it("lets a Super Admin suspend and reactivate an ordinary user", async () => {
    const superAdmin = await fixture("super_admin");
    const target = await fixture("viewer");

    // withRole always rolls back, so the suspend/read/reactivate/read
    // sequence has to happen on the one connection, inside the one
    // transaction, to observe its own writes.
    const { suspendedStatus, reactivatedStatus } = await withRole(
      superAdmin.userId,
      async (client) => {
        await client.query("select app.suspend_user($1)", [target.userId]);
        const afterSuspend = await client.query(
          "select status from public.profiles where id = $1",
          [target.userId],
        );

        await client.query("select app.reactivate_user($1)", [target.userId]);
        const afterReactivate = await client.query(
          "select status from public.profiles where id = $1",
          [target.userId],
        );

        return {
          suspendedStatus: afterSuspend.rows[0].status,
          reactivatedStatus: afterReactivate.rows[0].status,
        };
      },
    );

    expect(suspendedStatus).toBe("suspended");
    expect(reactivatedStatus).toBe("active");
  });
});

describe("Owner protection trigger", () => {
  it("blocks a direct DELETE of the Owner row, even as superuser", async () => {
    await expect(
      asSuperuser((client) =>
        client.query("delete from public.profiles where id = $1", [
          SEEDED_OWNER_ID,
        ]),
      ),
    ).rejects.toThrow();
  });

  it("blocks changing the Owner's role via direct UPDATE, even as superuser", async () => {
    await expect(
      asSuperuser((client) =>
        client.query(
          "update public.profiles set role = 'viewer' where id = $1",
          [SEEDED_OWNER_ID],
        ),
      ),
    ).rejects.toThrow();
  });

  it("never allows a second Owner to exist — the seeded Owner already occupies that slot", async () => {
    await expect(fixture("super_admin", { isOwner: true })).rejects.toThrow();
  });
});

describe("invitation gate trigger (app.handle_new_user)", () => {
  it("accepts a matching pending invitation and creates an active profile with its role", async () => {
    const superAdmin = await fixture("super_admin");
    const email = `invited-${crypto.randomUUID()}@example.com`;

    await asSuperuser((client) =>
      client.query(
        `insert into public.invitations (email, role, invited_by, expires_at)
         values ($1, 'admin', $2, now() + interval '14 days')`,
        [email, superAdmin.userId],
      ),
    );

    const signedIn = await createAuthUserRow(email);
    createdUserIds.push(signedIn.userId);

    const profile = await asSuperuser((client) =>
      client.query("select role, status from public.profiles where id = $1", [
        signedIn.userId,
      ]),
    );
    expect(profile.rows[0]).toEqual({ role: "admin", status: "active" });

    const invitation = await asSuperuser((client) =>
      client.query(
        "select status, accepted_profile_id from public.invitations where email = $1",
        [email],
      ),
    );
    expect(invitation.rows[0].status).toBe("accepted");
    expect(invitation.rows[0].accepted_profile_id).toBe(signedIn.userId);
  });

  it("creates no profile for an uninvited sign-in", async () => {
    const orphaned = await orphan();
    const profile = await asSuperuser((client) =>
      client.query("select 1 from public.profiles where id = $1", [
        orphaned.userId,
      ]),
    );
    expect(profile.rowCount).toBe(0);
  });

  it("creates no profile when the only matching invitation has expired", async () => {
    const superAdmin = await fixture("super_admin");
    const email = `expired-${crypto.randomUUID()}@example.com`;

    await asSuperuser((client) =>
      client.query(
        `insert into public.invitations (email, role, invited_by, expires_at)
         values ($1, 'viewer', $2, now() - interval '1 day')`,
        [email, superAdmin.userId],
      ),
    );

    const signedIn = await createAuthUserRow(email);
    createdUserIds.push(signedIn.userId);

    const profile = await asSuperuser((client) =>
      client.query("select 1 from public.profiles where id = $1", [
        signedIn.userId,
      ]),
    );
    expect(profile.rowCount).toBe(0);
  });

  it("matches invitation emails case-insensitively", async () => {
    const superAdmin = await fixture("super_admin");
    const email = `Mixed-Case-${crypto.randomUUID()}@Example.com`;

    await asSuperuser((client) =>
      client.query(
        `insert into public.invitations (email, role, invited_by, expires_at)
         values ($1, 'viewer', $2, now() + interval '14 days')`,
        [email.toLowerCase(), superAdmin.userId],
      ),
    );

    const signedIn = await createAuthUserRow(email);
    createdUserIds.push(signedIn.userId);

    const profile = await asSuperuser((client) =>
      client.query("select 1 from public.profiles where id = $1", [
        signedIn.userId,
      ]),
    );
    expect(profile.rowCount).toBe(1);
  });
});

describe("seeded database", () => {
  it("has exactly one Owner (docs/BLUEPRINT.md §4.7)", async () => {
    // Runs with fileParallelism disabled and no Owner fixtures left over
    // from other tests in this file (afterEach always cleans up), so this
    // reflects only what seed.sql produced.
    const result = await asSuperuser((client) =>
      client.query(
        "select count(*)::int as count from public.profiles where is_owner",
      ),
    );
    expect(result.rows[0].count).toBe(1);
  });
});
