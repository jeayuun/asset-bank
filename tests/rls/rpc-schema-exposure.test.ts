import { createClient } from "@supabase/supabase-js";
import { afterAll, describe, expect, it } from "vitest";

import type { Database } from "@/types/database.types";

/**
 * Everything in tests/rls/phase1.test.ts and phase2.test.ts connects to
 * Postgres directly, bypassing PostgREST — which is exactly how a real
 * bug shipped: `app.*` RPCs worked in those tests but were unreachable
 * from the actual app, because PostgREST only routes to schemas listed in
 * supabase/config.toml's `[api] schemas`, and supabase-js needs
 * `.schema('app')` on each call to target it. This test goes through the
 * real HTTP path — a real signed-in session calling
 * `.schema('app').rpc(...)` — so that class of bug can't come back
 * silently.
 *
 * Uses Supabase CLI's well-known local-dev demo keys directly (same
 * fallback pattern as ./helpers.ts) rather than lib/env.ts, since Vitest
 * doesn't load .env.local the way Next.js does and lib/env.ts requires
 * all six runtime vars to be present.
 */
const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321";
const ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0";
const SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";

const admin = createClient<Database>(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const createdUserIds: string[] = [];

afterAll(async () => {
  for (const id of createdUserIds) {
    await admin.auth.admin.deleteUser(id);
  }
});

describe("app schema RPCs are reachable through PostgREST", () => {
  it("lets a real authenticated Super Admin session call an app.* RPC", async () => {
    const email = `rpc-exposure-${crypto.randomUUID()}@rls-test.local`;
    const password = "test-password-not-a-real-account";

    const { data: created, error: createError } =
      await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });
    expect(createError).toBeNull();
    const userId = created!.user!.id;
    createdUserIds.push(userId);

    const { error: profileError } = await admin
      .from("profiles")
      .insert({ id: userId, email, role: "super_admin", status: "active" });
    expect(profileError).toBeNull();

    const anon = createClient<Database>(SUPABASE_URL, ANON_KEY);
    const { data: session, error: signInError } =
      await anon.auth.signInWithPassword({ email, password });
    expect(signInError).toBeNull();

    const userClient = createClient<Database>(SUPABASE_URL, ANON_KEY, {
      global: {
        headers: { Authorization: `Bearer ${session!.session!.access_token}` },
      },
    });

    const { data, error } = await userClient
      .schema("app")
      .rpc("unrecognized_sign_ins");

    // A real result (even an empty array), not a PostgREST routing error,
    // is what proves the schema is actually exposed and reachable.
    expect(error).toBeNull();
    expect(Array.isArray(data)).toBe(true);
  });

  it("refuses the same call for a Viewer, with a business-logic rejection — not a routing error", async () => {
    const email = `rpc-exposure-viewer-${crypto.randomUUID()}@rls-test.local`;
    const password = "test-password-not-a-real-account";

    const { data: created, error: createError } =
      await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });
    expect(createError).toBeNull();
    const userId = created!.user!.id;
    createdUserIds.push(userId);

    const { error: profileError } = await admin
      .from("profiles")
      .insert({ id: userId, email, role: "viewer", status: "active" });
    expect(profileError).toBeNull();

    const anon = createClient<Database>(SUPABASE_URL, ANON_KEY);
    const { data: session } = await anon.auth.signInWithPassword({
      email,
      password,
    });

    const userClient = createClient<Database>(SUPABASE_URL, ANON_KEY, {
      global: {
        headers: { Authorization: `Bearer ${session!.session!.access_token}` },
      },
    });

    const { error } = await userClient
      .schema("app")
      .rpc("unrecognized_sign_ins");

    expect(error).not.toBeNull();
    expect(error!.message).toContain("only a Super Admin");
  });
});
