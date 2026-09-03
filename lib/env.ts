import { z } from "zod";

/**
 * The complete runtime environment (docs/DECISIONS.md D-13). Deliberately
 * six variables — no Google OAuth secret, no JWT secret, no Google Drive
 * credential of any kind will ever be added here.
 *
 * Includes SUPABASE_SERVICE_ROLE_KEY and the Resend key, so this must
 * never be imported from a Client Component — use lib/env.client.ts there
 * instead. Not marked with the `server-only` package: scripts/check-owner.ts
 * is a legitimate consumer that runs via `tsx` outside Next.js's bundler,
 * and `server-only` only works through webpack/turbopack's conditional
 * resolution — it throws unconditionally under plain Node.
 */
const envSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  NEXT_PUBLIC_SITE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  RESEND_API_KEY: z.string().min(1),
  RESEND_FROM_EMAIL: z.string().email(),
});

function loadEnv() {
  const parsed = envSchema.safeParse(process.env);

  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`)
      .join("\n");
    throw new Error(
      `Invalid or missing environment variables:\n${issues}\n\nCopy .env.example to .env.local and fill in real values.`,
    );
  }

  return parsed.data;
}

export const env = loadEnv();
