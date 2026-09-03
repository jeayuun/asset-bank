import type { Metadata } from "next";

import { Logo } from "@/components/brand/logo";

export const metadata: Metadata = {
  title: "No access — Asset Bank",
};

/**
 * Shown after middleware/the callback route signs out a user whose Google
 * account matched no pending invitation (docs/BLUEPRINT.md §4.5).
 */
export default function NoAccessPage() {
  return (
    <main className="flex flex-1 items-center justify-center px-4 py-16">
      <div className="w-full max-w-sm text-center">
        <div className="mb-6 flex flex-col items-center gap-3">
          <Logo />
          <h1 className="text-xl font-semibold tracking-tight">No access</h1>
        </div>
        <p className="text-muted-foreground text-sm">
          That Google account doesn&apos;t have an active invitation to Asset
          Bank. If you believe this is a mistake, ask a Super Admin to invite
          the exact address you signed in with.
        </p>
      </div>
    </main>
  );
}
