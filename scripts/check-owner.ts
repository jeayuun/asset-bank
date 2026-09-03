import { createClient } from "@supabase/supabase-js";

import { env } from "@/lib/env";
import type { Database } from "@/types/database.types";

/**
 * Asserts exactly one Owner exists (docs/BLUEPRINT.md §4.7,
 * docs/DECISIONS.md D-04). The partial unique index on `is_owner` only
 * guarantees *at most* one — this closes the gap. Run in CI against the
 * seeded local database and as a post-deploy check.
 */
async function main() {
  const supabase = createClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY,
  );

  const { count, error } = await supabase
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .eq("is_owner", true);

  if (error) {
    console.error(error.message);
    process.exit(1);
  }

  if (count !== 1) {
    console.error(`Expected exactly one Owner, found ${count ?? 0}.`);
    process.exit(1);
  }

  console.log("Exactly one Owner exists.");
}

main();
