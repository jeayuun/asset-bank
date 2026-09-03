import { Client } from "pg";

const CONNECTION_STRING =
  process.env.SUPABASE_DB_URL ??
  "postgresql://postgres:postgres@127.0.0.1:54322/postgres";

/**
 * Runs `fn` as a real Postgres `authenticated`/`anon` role with
 * `auth.uid()` resolving to `userId`, exactly as PostgREST would set it up
 * for a real request — the standard way to exercise RLS policies directly
 * against Postgres. Everything runs inside a transaction that's always
 * rolled back, so tests never leave fixture data behind.
 */
export async function withRole<T>(
  userId: string | null,
  fn: (client: Client) => Promise<T>,
): Promise<T> {
  const client = new Client({ connectionString: CONNECTION_STRING });
  await client.connect();

  try {
    await client.query("begin");
    if (userId) {
      await client.query("set local role authenticated");
      await client.query("select set_config('request.jwt.claims', $1, true)", [
        JSON.stringify({ sub: userId, role: "authenticated" }),
      ]);
    } else {
      await client.query("set local role anon");
    }
    return await fn(client);
  } finally {
    await client.query("rollback").catch(() => {});
    await client.end();
  }
}

/** Superuser access, for fixture setup/teardown outside RLS. */
export async function asSuperuser<T>(
  fn: (client: Client) => Promise<T>,
): Promise<T> {
  const client = new Client({ connectionString: CONNECTION_STRING });
  await client.connect();
  try {
    return await fn(client);
  } finally {
    await client.end();
  }
}

export interface FixtureProfile {
  userId: string;
  email: string;
}

/**
 * Inserts a matching auth.users + profiles row directly (bypassing the
 * invitation-gate trigger, which is tested separately) so RLS tests don't
 * depend on seed.sql's specific fixture data.
 */
export async function createFixtureProfile(
  role: "viewer" | "admin" | "super_admin",
  opts: { status?: "active" | "suspended"; isOwner?: boolean } = {},
): Promise<FixtureProfile> {
  const userId = crypto.randomUUID();
  const email = `${userId}@rls-test.local`;

  await asSuperuser(async (client) => {
    await client.query(
      `insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at)
       values ('00000000-0000-0000-0000-000000000000', $1, 'authenticated', 'authenticated', $2, '', now(), now(), now())`,
      [userId, email],
    );
    // The on_auth_user_created trigger fires on that insert and (finding
    // no invitation and no bootstrap match) creates no profile — insert
    // the fixture profile explicitly with the exact role/status under test.
    await client.query(
      `insert into public.profiles (id, email, role, status, is_owner)
       values ($1, $2, $3, $4, $5)`,
      [userId, email, role, opts.status ?? "active", opts.isOwner ?? false],
    );
  });

  return { userId, email };
}

/**
 * Inserts a bare auth.users row, firing app.handle_new_user() for real.
 * With no matching invitation this simulates an uninvited sign-in
 * (no profile created); pass a pending invitation's email to exercise the
 * accept path instead.
 */
export async function createAuthUserRow(
  email?: string,
): Promise<FixtureProfile> {
  const userId = crypto.randomUUID();
  const resolvedEmail = email ?? `${userId}@rls-test.local`;

  await asSuperuser(async (client) => {
    await client.query(
      `insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at)
       values ('00000000-0000-0000-0000-000000000000', $1, 'authenticated', 'authenticated', $2, '', now(), now(), now())`,
      [userId, resolvedEmail],
    );
  });

  return { userId, email: resolvedEmail };
}

/** Alias for the common case: no invitation exists for this fresh user. */
export const createOrphanAuthUser = createAuthUserRow;

/**
 * Deletes a fixture user (cascades to its profile). Owner fixtures need
 * app.protect_owner temporarily disabled — it deliberately blocks DELETE
 * on an is_owner row, which is exactly what the FK cascade from
 * auth.users would trigger otherwise.
 */
export async function deleteFixtureProfile(userId: string): Promise<void> {
  await asSuperuser(async (client) => {
    await client.query(
      "alter table public.profiles disable trigger protect_owner",
    );
    try {
      await client.query("delete from auth.users where id = $1", [userId]);
    } finally {
      await client.query(
        "alter table public.profiles enable trigger protect_owner",
      );
    }
  });
}
