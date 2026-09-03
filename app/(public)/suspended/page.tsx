import type { Metadata } from "next";

import { Logo } from "@/components/brand/logo";

export const metadata: Metadata = {
  title: "Account suspended — Asset Bank",
};

/**
 * Shown after middleware/the callback route signs out a suspended user
 * (docs/BLUEPRINT.md §4.4).
 */
export default function SuspendedPage() {
  return (
    <main className="flex flex-1 items-center justify-center px-4 py-16">
      <div className="w-full max-w-sm text-center">
        <div className="mb-6 flex flex-col items-center gap-3">
          <Logo />
          <h1 className="text-xl font-semibold tracking-tight">
            Account suspended
          </h1>
        </div>
        <p className="text-muted-foreground text-sm">
          Your Asset Bank account has been suspended. Contact a Super Admin if
          you believe this is a mistake.
        </p>
      </div>
    </main>
  );
}
