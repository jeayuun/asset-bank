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

describe("notification fan-out on status change", () => {
  it("notifies a watcher but not the actor who made the change", async () => {
    const requester = await fixture();
    const admin = await fixture("admin");
    const requestId = await makeRequest(requester.userId);
    createdRequestIds.push(requestId);

    // Mutation and verification have to happen inside the same
    // withRole() transaction — it always rolls back on exit, so a write
    // made there is never observable from a later, separate
    // withRole()/asSuperuser() call (the recurring bug class fixed in
    // every earlier phase's test suite too).
    //
    // Reading back through app.pending_notification_emails_for_entity()
    // rather than a plain `select from notifications` — the recipient
    // here (the requester) is a *different* person from the querying
    // session (the admin, who made the change), and notifications'
    // SELECT policy is `recipient_id = uid()`: a plain query as the
    // admin would correctly, silently see zero rows regardless of
    // whether the trigger worked, since none of the newly created
    // notifications belong to the admin. This is exactly the scoped,
    // cross-recipient read path the RPC exists for.
    const rows = await withRole(admin.userId, async (client) => {
      const before = await client.query("select now() as ts");
      await client.query(
        "select app.change_request_status($1, 'under_review')",
        [requestId],
      );
      const result = await client.query(
        "select recipient_email from app.pending_notification_emails_for_entity('asset_request', $1, $2)",
        [requestId, before.rows[0].ts],
      );
      return result.rows;
    });

    expect(rows).toEqual([{ recipient_email: requester.email }]);
  });

  it("does not notify a requester who cancels their own request", async () => {
    const requester = await fixture();
    const requestId = await makeRequest(requester.userId);
    createdRequestIds.push(requestId);

    const rowCount = await withRole(requester.userId, async (client) => {
      const before = await client.query("select now() as ts");
      await client.query("select app.change_request_status($1, 'cancelled')", [
        requestId,
      ]);
      const result = await client.query(
        "select 1 from app.pending_notification_emails_for_entity('asset_request', $1, $2)",
        [requestId, before.rows[0].ts],
      );
      return result.rowCount;
    });
    expect(rowCount).toBe(0);
  });
});

describe("notification fan-out on assignment", () => {
  it("notifies the assignee, including when they assign themselves", async () => {
    const requester = await fixture();
    const admin = await fixture("admin");
    const requestId = await makeRequest(requester.userId);
    createdRequestIds.push(requestId);

    const rows = await withRole(admin.userId, async (client) => {
      await client.query("select app.assign_request($1, $2)", [
        requestId,
        admin.userId,
      ]);
      const result = await client.query(
        "select recipient_id, type from public.notifications where entity_type = 'asset_request' and entity_id = $1 and type = 'request_assigned'",
        [requestId],
      );
      return result.rows;
    });
    expect(rows).toEqual([
      { recipient_id: admin.userId, type: "request_assigned" },
    ]);
  });
});

describe("notification fan-out on comment", () => {
  it("notifies a watcher but not the comment's own author", async () => {
    const requester = await fixture();
    const admin = await fixture("admin");
    const requestId = await makeRequest(requester.userId);
    createdRequestIds.push(requestId);

    const rows = await withRole(admin.userId, async (client) => {
      const before = await client.query("select now() as ts");
      const inserted = await client.query(
        "insert into public.request_comments (request_id, author_id, body) values ($1, $2, 'hi') returning id",
        [requestId, admin.userId],
      );
      const commentId = inserted.rows[0].id as string;
      const result = await client.query(
        "select recipient_email from app.pending_notification_emails_for_entity('request_comment', $1, $2)",
        [commentId, before.rows[0].ts],
      );
      return result.rows;
    });
    expect(rows).toEqual([{ recipient_email: requester.email }]);
  });
});

describe("app.notify respects the in_app preference", () => {
  it("creates no row when in_app is off, but does when no preference exists (opt-out default)", async () => {
    const optedOut = await fixture();
    const defaultOn = await fixture();
    const admin = await fixture("admin");
    const optedOutRequestId = await makeRequest(optedOut.userId);
    const defaultOnRequestId = await makeRequest(defaultOn.userId);
    createdRequestIds.push(optedOutRequestId, defaultOnRequestId);

    await asSuperuser((client) =>
      client.query(
        "insert into public.notification_preferences (profile_id, type, in_app, email) values ($1, 'request_status_changed', false, false)",
        [optedOut.userId],
      ),
    );

    const [optedOutCount, defaultOnCount] = await withRole(
      admin.userId,
      async (client) => {
        const before = await client.query("select now() as ts");
        await client.query(
          "select app.change_request_status($1, 'under_review')",
          [optedOutRequestId],
        );
        await client.query(
          "select app.change_request_status($1, 'under_review')",
          [defaultOnRequestId],
        );
        const optedOutResult = await client.query(
          "select 1 from app.pending_notification_emails_for_entity('asset_request', $1, $2)",
          [optedOutRequestId, before.rows[0].ts],
        );
        const defaultOnResult = await client.query(
          "select 1 from app.pending_notification_emails_for_entity('asset_request', $1, $2)",
          [defaultOnRequestId, before.rows[0].ts],
        );
        return [optedOutResult.rowCount, defaultOnResult.rowCount];
      },
    );

    expect(optedOutCount).toBe(0);
    expect(defaultOnCount).toBe(1);
  });
});

describe("notifications RLS", () => {
  // Deliberately per-test, not beforeAll(): a shared fixture here would
  // get cascade-deleted the moment the *first* test's afterEach() tears
  // down its recipient/stranger profiles (createdUserIds is drained
  // after every test, not once at the end of the describe block) —
  // notifications.recipient_id is ON DELETE CASCADE, so every test after
  // the first would silently find the row already gone.
  async function makeNotification(recipientId: string) {
    return asSuperuser(async (client) => {
      const result = await client.query(
        `insert into public.notifications (recipient_id, type, title, entity_type, entity_id)
         values ($1, 'request_comment', 'Test notification', 'request_comment', 'x') returning id`,
        [recipientId],
      );
      return result.rows[0].id as string;
    });
  }

  it("shows a notification only to its recipient", async () => {
    const recipient = await fixture();
    const stranger = await fixture();
    const notificationId = await makeNotification(recipient.userId);

    const own = await withRole(recipient.userId, (client) =>
      client.query("select * from public.notifications where id = $1", [
        notificationId,
      ]),
    );
    expect(own.rowCount).toBe(1);

    const other = await withRole(stranger.userId, (client) =>
      client.query("select * from public.notifications where id = $1", [
        notificationId,
      ]),
    );
    expect(other.rowCount).toBe(0);
  });

  it("denies a direct INSERT — notifications are trigger/service only", async () => {
    const recipient = await fixture();

    await expect(
      withRole(recipient.userId, (client) =>
        client.query(
          "insert into public.notifications (recipient_id, type, title, entity_type, entity_id) values ($1, 'request_comment', 'Nope', 'request_comment', 'x')",
          [recipient.userId],
        ),
      ),
    ).rejects.toThrow();
  });

  it("lets the recipient mark their own notification read, but not touch other columns", async () => {
    const recipient = await fixture();
    const notificationId = await makeNotification(recipient.userId);

    const result = await withRole(recipient.userId, (client) =>
      client.query(
        "update public.notifications set read_at = now() where id = $1 returning read_at",
        [notificationId],
      ),
    );
    expect(result.rows[0].read_at).not.toBeNull();

    await expect(
      withRole(recipient.userId, (client) =>
        client.query(
          "update public.notifications set title = 'hijacked' where id = $1",
          [notificationId],
        ),
      ),
    ).rejects.toThrow();
  });

  it("lets the recipient delete their own notification, denies a stranger", async () => {
    const recipient = await fixture();
    const stranger = await fixture();
    const notificationId = await makeNotification(recipient.userId);

    const strangerAttempt = await withRole(stranger.userId, (client) =>
      client.query("delete from public.notifications where id = $1", [
        notificationId,
      ]),
    );
    expect(strangerAttempt.rowCount).toBe(0);

    const ownDelete = await withRole(recipient.userId, (client) =>
      client.query(
        "delete from public.notifications where id = $1 returning id",
        [notificationId],
      ),
    );
    expect(ownDelete.rowCount).toBe(1);
  });
});

describe("notification_preferences RLS", () => {
  it("lets a user manage only their own preferences", async () => {
    const viewer = await fixture();
    const other = await fixture();

    const ownInsert = await withRole(viewer.userId, (client) =>
      client.query(
        "insert into public.notification_preferences (profile_id, type, in_app, email) values ($1, 'request_comment', false, true) returning profile_id",
        [viewer.userId],
      ),
    );
    expect(ownInsert.rowCount).toBe(1);

    await expect(
      withRole(other.userId, (client) =>
        client.query(
          "insert into public.notification_preferences (profile_id, type, in_app, email) values ($1, 'request_comment', false, true)",
          [viewer.userId],
        ),
      ),
    ).rejects.toThrow();
  });
});

describe("app.pending_notification_emails_for_entity", () => {
  it("lets the actor (not the recipient) retrieve the recipient's pending email — the bug this RPC exists to fix", async () => {
    const requester = await fixture();
    const admin = await fixture("admin");
    const requestId = await makeRequest(requester.userId);
    createdRequestIds.push(requestId);

    const rows = await withRole(admin.userId, async (client) => {
      const before = await client.query("select now() as ts");
      await client.query(
        "select app.change_request_status($1, 'under_review')",
        [requestId],
      );
      const pending = await client.query(
        "select recipient_email, title from app.pending_notification_emails_for_entity('asset_request', $1, $2)",
        [requestId, before.rows[0].ts],
      );
      return pending.rows;
    });

    expect(rows).toHaveLength(1);
    expect(rows[0].recipient_email).toBe(requester.email);
    expect(rows[0].title).toMatch(/^Request REQ-\d{4} is now under_review$/);
  });
});
