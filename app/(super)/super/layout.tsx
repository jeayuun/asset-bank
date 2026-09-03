import type { ReactNode } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";

import { AppHeader } from "@/components/shell/app-header";
import { getCurrentProfile } from "@/lib/auth/session";

export default async function SuperLayout({
  children,
}: {
  children: ReactNode;
}) {
  const profile = await getCurrentProfile();

  // Route-level access is middleware's job (/super/* is Super-Admin-only);
  // this only covers the case of reaching the layout with no session at
  // all, mirroring app/(app)/layout.tsx.
  if (!profile) {
    redirect("/login");
  }

  return (
    <div className="flex min-h-full flex-col">
      <AppHeader profile={profile} />
      <div className="mx-auto flex w-full max-w-5xl flex-1 gap-8 px-6 py-8">
        <nav className="w-40 shrink-0 space-y-1 text-sm">
          <Link
            href="/super/users"
            className="hover:bg-accent block rounded-md px-3 py-2"
          >
            Users
          </Link>
          <Link
            href="/super/invitations"
            className="hover:bg-accent block rounded-md px-3 py-2"
          >
            Invitations
          </Link>
          <Link
            href="/super/taxonomy"
            className="hover:bg-accent block rounded-md px-3 py-2"
          >
            Taxonomy
          </Link>
        </nav>
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </div>
  );
}
