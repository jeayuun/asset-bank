import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

// Google Drive must never gain an API client, scope, credential, SDK, or
// service account (CLAUDE.md §4, docs/DECISIONS.md D-13). The service-role
// Supabase client is confined to modules genuinely marked server-only
// (docs/BLUEPRINT.md §2.3).
const driveAndServiceRoleGuard = {
  files: ["**/*.{ts,tsx}"],
  rules: {
    "no-restricted-imports": [
      "error",
      {
        paths: [
          {
            name: "googleapis",
            message:
              "Google Drive API access is permanently out of scope. See CLAUDE.md §4.",
          },
          {
            name: "google-auth-library",
            message:
              "Google Drive API access is permanently out of scope. See CLAUDE.md §4.",
          },
        ],
        patterns: [
          {
            group: ["*/lib/supabase/service", "@/lib/supabase/service"],
            message:
              "The service-role Supabase client is confined to allow-listed server-only modules. See docs/BLUEPRINT.md §2.3.",
          },
        ],
      },
    ],
  },
};

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  driveAndServiceRoleGuard,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
