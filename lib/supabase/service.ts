import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

import { env } from "@/lib/env";
import type { Database } from "@/types/database.types";

/**
 * Service-role client. Confined to modules genuinely marked server-only
 * (docs/BLUEPRINT.md §2.3); the ESLint no-restricted-imports rule blocks
 * importing this module from anywhere outside an allow-listed directory.
 * Every service-role write must emit an audit row.
 */
export function createServiceClient() {
  return createSupabaseClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}
