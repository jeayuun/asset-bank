import type { Metadata } from "next";

import { GoogleSignInButton } from "@/components/auth/google-sign-in-button";
import { Logo } from "@/components/brand/logo";

export const metadata: Metadata = {
  title: "Sign in — Asset Bank",
};

/**
 * Branded sign-in screen (docs/DECISIONS.md D-15). Wired to real Google
 * OAuth as of Phase 1, without a visual change from the Phase 0 mock.
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
          <p className="text-muted-foreground text-sm">
            Use the personal Google account you were individually invited with.
          </p>
        </div>

        <div className="border-border bg-card rounded-xl border p-6 shadow-sm">
          <GoogleSignInButton />

          <div className="border-border text-muted-foreground mt-6 space-y-3 border-t pt-6 text-xs">
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
