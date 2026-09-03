import { afterEach, describe, expect, it } from "vitest";

import {
  asSuperuser,
  createFixtureProfile,
  deleteFixtureProfile,
  type FixtureProfile,
  withRole,
} from "./helpers";

const createdUserIds: string[] = [];
const createdRequestIds: string[] = [];

async function fixture(
  role: "viewer" | "admin" | "super_admin" = "viewer",
): Promise<FixtureProfile> {
  const profile = await createFixtureProfile(role);
  createdUserIds.push(profile.userId);
  return profile;
}

afterEach(async () => {
  if (createdRequestIds.length > 0) {
    await asSuperuser((client) =>
      client.query(
        "delete from public.asset_requests where id = any($1::uuid[])",
        [createdRequestIds],
      ),
    );
    createdRequestIds.length = 0;
  }

  while (createdUserIds.length > 0) {
    const id = createdUserIds.pop();
    if (id) await deleteFixtureProfile(id);
  }
});

async function makeRequest(requesterId: string, title = "Test request") {
  return asSuperuser(async (client) => {
    const result = await client.query(
      `insert into public.asset_requests (title, requested_by) values ($1, $2) returning id`,
      [title, requesterId],
    );
    return result.rows[0].id as string;
  });
}

describe("asset_requests creation", () => {
  it("generates a REQ-#### reference and auto-watches the requester", async () => {
    const requester = await fixture();

    // Insert and the watcher-visibility check both have to happen inside
    // the same withRole() transaction — it always rolls back on exit, so
    // a write made in one withRole() call is never observable from a
    // later, separate withRole()/asSuperuser() call (the same bug class
    // fixed repeatedly in earlier phases' test suites).
    //
    // No RETURNING on the INSERT itself: asset_requests' SELECT policy
    // (app.can_see_request()) looks the row up by id, and Postgres checks
    // INSERT...RETURNING rows against SELECT policies using a
    // start-of-statement snapshot — so that self-referential check can't
    // see the row it's checking yet, and RETURNING fails with a spurious
    // RLS error every time. The real app.(app)/requests/actions.ts hits
    // this exact case and works around it the same way: generate the id
    // client-side, insert without RETURNING, read it back separately.
    const requestId = crypto.randomUUID();
    const { reference, watcherIds } = await withRole(
      requester.userId,
      async (client) => {
        await client.query(
          "insert into public.asset_requests (id, title, requested_by) values ($1, 'Need a triangle', $2)",
          [requestId, requester.userId],
        );
        const inserted = await client.query(
          "select reference from public.asset_requests where id = $1",
          [requestId],
        );
        const watchers = await client.query(
          "select profile_id from public.request_watchers where request_id = $1",
          [requestId],
        );
        return {
          reference: inserted.rows[0].reference as string,
          watcherIds: watchers.rows.map((r) => r.profile_id as string),
        };
      },
    );

    expect(reference).toMatch(/^REQ-\d{4}$/);
    expect(watcherIds).toEqual([requester.userId]);
  });

  it("denies creating a request on someone else's behalf", async () => {
    const viewer = await fixture();
    const other = await fixture();

    await expect(
      withRole(viewer.userId, (client) =>
        client.query(
          "insert into public.asset_requests (title, requested_by) values ('Nope', $1)",
          [other.userId],
        ),
      ),
    ).rejects.toThrow();
  });
});

describe("asset_requests visibility (docs/DECISIONS.md D-10)", () => {
  it("hides a request from a stranger but shows it to the requester, a watcher, and an Admin", async () => {
    const requester = await fixture();
    const watcher = await fixture();
    const stranger = await fixture();
    const admin = await fixture("admin");
    const requestId = await makeRequest(requester.userId);
    createdRequestIds.push(requestId);

    await asSuperuser((client) =>
      client.query(
        "insert into public.request_watchers (request_id, profile_id) values ($1, $2)",
        [requestId, watcher.userId],
      ),
    );

    const asStranger = await withRole(stranger.userId, (client) =>
      client.query("select * from public.asset_requests where id = $1", [
        requestId,
      ]),
    );
    expect(asStranger.rowCount).toBe(0);

    const asRequester = await withRole(requester.userId, (client) =>
      client.query("select * from public.asset_requests where id = $1", [
        requestId,
      ]),
    );
    expect(asRequester.rowCount).toBe(1);

    const asWatcher = await withRole(watcher.userId, (client) =>
      client.query("select * from public.asset_requests where id = $1", [
        requestId,
      ]),
    );
    expect(asWatcher.rowCount).toBe(1);

    const asAdmin = await withRole(admin.userId, (client) =>
      client.query("select * from public.asset_requests where id = $1", [
        requestId,
      ]),
    );
    expect(asAdmin.rowCount).toBe(1);
  });
});

describe("app.change_request_status transition matrix (docs/BLUEPRINT.md §9)", () => {
  it("denies a Viewer from moving submitted to under_review", async () => {
    const requester = await fixture();
    const requestId = await makeRequest(requester.userId);
    createdRequestIds.push(requestId);

    await expect(
      withRole(requester.userId, (client) =>
        client.query("select app.change_request_status($1, 'under_review')", [
          requestId,
        ]),
      ),
    ).rejects.toThrow(/Admin/);
  });

  it("lets the requester cancel their own submitted request, but denies a stranger", async () => {
    const requester = await fixture();
    const stranger = await fixture();
    const requestId = await makeRequest(requester.userId);
    createdRequestIds.push(requestId);

    await expect(
      withRole(stranger.userId, (client) =>
        client.query("select app.change_request_status($1, 'cancelled')", [
          requestId,
        ]),
      ),
    ).rejects.toThrow();

    const result = await withRole(requester.userId, async (client) => {
      await client.query("select app.change_request_status($1, 'cancelled')", [
        requestId,
      ]);
      return client.query(
        "select status from public.asset_requests where id = $1",
        [requestId],
      );
    });
    expect(result.rows[0].status).toBe("cancelled");
  });

  it("refuses to enter in_progress before assigned_to is set, then succeeds after assigning", async () => {
    const admin = await fixture("admin");
    const requestId = await makeRequest(admin.userId);
    createdRequestIds.push(requestId);

    // Fast-forward setup state directly (asSuperuser writes persist,
    // unlike withRole() — see the note in the first test above) so each
    // withRole() call below only has to exercise the one transition
    // actually under test.
    await asSuperuser((client) =>
      client.query(
        "update public.asset_requests set status = 'approved' where id = $1",
        [requestId],
      ),
    );

    await expect(
      withRole(admin.userId, (client) =>
        client.query("select app.change_request_status($1, 'in_progress')", [
          requestId,
        ]),
      ),
    ).rejects.toThrow(/assign/);

    const status = await withRole(admin.userId, async (client) => {
      await client.query("select app.assign_request($1, $2)", [
        requestId,
        admin.userId,
      ]);
      await client.query(
        "select app.change_request_status($1, 'in_progress')",
        [requestId],
      );
      const result = await client.query(
        "select status from public.asset_requests where id = $1",
        [requestId],
      );
      return result.rows[0].status as string;
    });
    expect(status).toBe("in_progress");
  });

  it("requires a non-empty note to reject a request", async () => {
    const admin = await fixture("admin");
    const requestId = await makeRequest(admin.userId);
    createdRequestIds.push(requestId);

    await asSuperuser((client) =>
      client.query(
        "update public.asset_requests set status = 'under_review' where id = $1",
        [requestId],
      ),
    );

    await expect(
      withRole(admin.userId, (client) =>
        client.query("select app.change_request_status($1, 'rejected')", [
          requestId,
        ]),
      ),
    ).rejects.toThrow(/note/);

    await expect(
      withRole(admin.userId, (client) =>
        client.query(
          "select app.change_request_status($1, 'rejected', 'Out of scope')",
          [requestId],
        ),
      ),
    ).resolves.not.toThrow();
  });

  it("requires at least one deliverable to complete a request", async () => {
    const admin = await fixture("admin");
    const requestId = await makeRequest(admin.userId);
    createdRequestIds.push(requestId);

    await asSuperuser((client) =>
      client.query(
        "update public.asset_requests set status = 'in_progress', assigned_to = $2 where id = $1",
        [requestId, admin.userId],
      ),
    );

    await expect(
      withRole(admin.userId, (client) =>
        client.query("select app.change_request_status($1, 'completed')", [
          requestId,
        ]),
      ),
    ).rejects.toThrow(/deliverable/);

    await asSuperuser((client) =>
      client.query(
        "insert into public.request_deliverables (request_id, drive_url, label) values ($1, 'https://drive.google.com/file/d/x/view', 'Icon')",
        [requestId],
      ),
    );

    await expect(
      withRole(admin.userId, (client) =>
        client.query("select app.change_request_status($1, 'completed')", [
          requestId,
        ]),
      ),
    ).resolves.not.toThrow();
  });

  it("rejects an illegal jump in the transition matrix", async () => {
    const admin = await fixture("admin");
    const requestId = await makeRequest(admin.userId);
    createdRequestIds.push(requestId);

    await expect(
      withRole(admin.userId, (client) =>
        client.query("select app.change_request_status($1, 'completed')", [
          requestId,
        ]),
      ),
    ).rejects.toThrow(/not a valid transition/);
  });
});

describe("app.assign_request", () => {
  it("refuses to assign to a Viewer", async () => {
    const admin = await fixture("admin");
    const viewer = await fixture();
    const requestId = await makeRequest(admin.userId);
    createdRequestIds.push(requestId);

    await expect(
      withRole(admin.userId, (client) =>
        client.query("select app.assign_request($1, $2)", [
          requestId,
          viewer.userId,
        ]),
      ),
    ).rejects.toThrow(/Admin or Super Admin/);
  });

  it("denies a Viewer from assigning a request", async () => {
    const admin = await fixture("admin");
    const viewer = await fixture();
    const requestId = await makeRequest(admin.userId);
    createdRequestIds.push(requestId);

    await expect(
      withRole(viewer.userId, (client) =>
        client.query("select app.assign_request($1, $2)", [
          requestId,
          admin.userId,
        ]),
      ),
    ).rejects.toThrow(/Admin/);
  });
});

describe("request_comments", () => {
  it("denies commenting on a request the user can't see, and auto-watches on comment", async () => {
    const requester = await fixture();
    const stranger = await fixture();
    const requestId = await makeRequest(requester.userId);
    createdRequestIds.push(requestId);

    await expect(
      withRole(stranger.userId, (client) =>
        client.query(
          "insert into public.request_comments (request_id, author_id, body) values ($1, $2, 'hi')",
          [requestId, stranger.userId],
        ),
      ),
    ).rejects.toThrow();

    const watcherRowCount = await withRole(requester.userId, async (client) => {
      await client.query(
        "insert into public.request_comments (request_id, author_id, body) values ($1, $2, 'hi')",
        [requestId, requester.userId],
      );
      const watchers = await client.query(
        "select profile_id from public.request_watchers where request_id = $1 and profile_id = $2",
        [requestId, requester.userId],
      );
      return watchers.rowCount;
    });
    expect(watcherRowCount).toBe(1);
  });

  it("lets the author edit their own comment, denies another Viewer", async () => {
    const requester = await fixture();
    const other = await fixture();
    const requestId = await makeRequest(requester.userId);
    createdRequestIds.push(requestId);

    await asSuperuser((client) =>
      client.query(
        "insert into public.request_watchers (request_id, profile_id) values ($1, $2)",
        [requestId, other.userId],
      ),
    );
    const commentId = await asSuperuser(async (client) => {
      const result = await client.query(
        "insert into public.request_comments (request_id, author_id, body) values ($1, $2, 'original') returning id",
        [requestId, requester.userId],
      );
      return result.rows[0].id as string;
    });

    // RLS's UPDATE policy filters via USING, which silently excludes a
    // non-matching row from the update set (0 rows affected) rather than
    // throwing — unlike an INSERT's WITH CHECK failure or a trigger's
    // explicit RAISE, both of which do throw. Assert the no-op, not a
    // rejection.
    const hijackAttempt = await withRole(other.userId, (client) =>
      client.query(
        "update public.request_comments set body = 'hijacked' where id = $1",
        [commentId],
      ),
    );
    expect(hijackAttempt.rowCount).toBe(0);

    const result = await withRole(requester.userId, (client) =>
      client.query(
        "update public.request_comments set body = 'edited' where id = $1 returning body",
        [commentId],
      ),
    );
    expect(result.rows[0].body).toBe("edited");
  });
});

describe("request_deliverables", () => {
  it("denies a Viewer from attaching a deliverable, allows an Admin", async () => {
    const admin = await fixture("admin");
    const requestId = await makeRequest(admin.userId);
    createdRequestIds.push(requestId);

    const viewer = await fixture();
    await expect(
      withRole(viewer.userId, (client) =>
        client.query(
          "insert into public.request_deliverables (request_id, drive_url, label) values ($1, 'https://drive.google.com/file/d/x/view', 'Nope')",
          [requestId],
        ),
      ),
    ).rejects.toThrow();

    const result = await withRole(admin.userId, (client) =>
      client.query(
        "insert into public.request_deliverables (request_id, drive_url, label) values ($1, 'https://drive.google.com/file/d/x/view', 'Icon') returning id",
        [requestId],
      ),
    );
    expect(result.rowCount).toBe(1);
  });
});

describe("request_watchers", () => {
  it("denies a Viewer from adding a watcher directly, allows an Admin", async () => {
    const admin = await fixture("admin");
    const viewer = await fixture();
    const toWatch = await fixture();
    const requestId = await makeRequest(admin.userId);
    createdRequestIds.push(requestId);

    await expect(
      withRole(viewer.userId, (client) =>
        client.query(
          "insert into public.request_watchers (request_id, profile_id) values ($1, $2)",
          [requestId, toWatch.userId],
        ),
      ),
    ).rejects.toThrow();

    const result = await withRole(admin.userId, (client) =>
      client.query(
        "insert into public.request_watchers (request_id, profile_id) values ($1, $2) returning profile_id",
        [requestId, toWatch.userId],
      ),
    );
    expect(result.rowCount).toBe(1);
  });
});

describe("app.request_participant_emails", () => {
  it("resolves emails for a request's requester and watchers, scoped to visibility", async () => {
    const requester = await fixture();
    const watcher = await fixture();
    const stranger = await fixture();
    const requestId = await makeRequest(requester.userId);
    createdRequestIds.push(requestId);

    await asSuperuser((client) =>
      client.query(
        "insert into public.request_watchers (request_id, profile_id) values ($1, $2)",
        [requestId, watcher.userId],
      ),
    );

    const asRequester = await withRole(requester.userId, (client) =>
      client.query(
        "select profile_id, email from app.request_participant_emails($1)",
        [requestId],
      ),
    );
    expect(asRequester.rows.map((r) => r.profile_id).sort()).toEqual(
      [requester.userId, watcher.userId].sort(),
    );

    const asStranger = await withRole(stranger.userId, (client) =>
      client.query(
        "select profile_id, email from app.request_participant_emails($1)",
        [requestId],
      ),
    );
    expect(asStranger.rowCount).toBe(0);
  });
});
