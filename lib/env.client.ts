import { z } from "zod";

/**
 * The subset of lib/env.ts safe to bundle into client code: the two
 * NEXT_PUBLIC_ values the browser Supabase client needs. Everything else
 * (service-role key, Resend key) stays in lib/env.ts, which is marked
 * server-only and must never be imported here or from a Client Component.
 */
const clientEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
});

function loadClientEnv() {
  const parsed = clientEnvSchema.safeParse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  });

  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`)
      .join("\n");
    throw new Error(
      `Invalid or missing public environment variables:\n${issues}`,
    );
  }

  return parsed.data;
}

export const clientEnv = loadClientEnv();
