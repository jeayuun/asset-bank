import type { Metadata } from "next";

import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Sign in — Asset Bank",
};

/**
 * Branded sign-in screen (docs/DECISIONS.md D-15). Non-functional in
 * Phase 0: Google OAuth is wired up in Phase 1 without a visual change.
 */
export default function LoginPage() {
  return (
    <main className="flex flex-1 items-center justify-center px-4 py-16">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-3 text-center">
          <Logo />
          <h1 className="text-xl font-semibold tracking-tight">
            Sign in to Asset Bank
          </h1>
          <p className="text-sm text-muted-foreground">
            Use the personal Google account you were individually invited
            with.
          </p>
        </div>

        <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
          <Button
            type="button"
            disabled
            className="w-full"
            aria-describedby="login-disabled-note"
          >
            <GoogleGlyph />
            Continue with Google
          </Button>
          <p id="login-disabled-note" className="mt-3 text-center text-xs text-muted-foreground">
            Sign-in is not wired up yet in this build.
          </p>

          <div className="mt-6 space-y-3 border-t border-border pt-6 text-xs text-muted-foreground">
            <p>
              Asset Bank is invitation-only. If you weren&apos;t individually
              invited, signing in won&apos;t grant access.
            </p>
            <p>
              We only request your Google account&apos;s name, email, and
              profile photo. Asset Bank never requests access to your Google
              Drive.
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}

function GoogleGlyph() {
  return (
    <svg viewBox="0 0 18 18" className="h-4 w-4 shrink-0" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.9c1.7-1.56 2.7-3.87 2.7-6.62Z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.9-2.26c-.8.54-1.84.86-3.06.86-2.35 0-4.34-1.59-5.05-3.72H.95v2.33A9 9 0 0 0 9 18Z"
      />
      <path
        fill="#FBBC05"
        d="M3.95 10.7A5.4 5.4 0 0 1 3.66 9c0-.59.1-1.17.29-1.7V4.97H.95A9 9 0 0 0 0 9c0 1.45.35 2.83.95 4.03l3-2.33Z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.32 0 2.51.46 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .95 4.97l3 2.33C4.66 5.17 6.65 3.58 9 3.58Z"
      />
    </svg>
  );
}
