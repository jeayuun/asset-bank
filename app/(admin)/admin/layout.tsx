import type { ReactNode } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";

import { AppHeader } from "@/components/shell/app-header";
import { getCurrentProfile } from "@/lib/auth/session";

export default async function AdminLayout({
  children,
}: {
  children: ReactNode;
}) {
  const profile = await getCurrentProfile();

  // Route-level access is middleware's job (/admin/* is Admin-and-above
  // only); this only covers reaching the layout with no session at all,
  // mirroring app/(app)/layout.tsx and app/(super)/super/layout.tsx.
  if (!profile) {
    redirect("/login");
  }

  return (
    <div className="flex min-h-full flex-col">
      <AppHeader profile={profile} />
      <div className="mx-auto flex w-full max-w-5xl flex-1 gap-8 px-6 py-8">
        <nav className="w-40 shrink-0 space-y-1 text-sm">
          <Link
            href="/admin/assets"
            className="hover:bg-accent block rounded-md px-3 py-2"
          >
            Assets
          </Link>
          <Link
            href="/admin/curriculum"
            className="hover:bg-accent block rounded-md px-3 py-2"
          >
            Curriculum
          </Link>
          <Link
            href="/admin/characters"
            className="hover:bg-accent block rounded-md px-3 py-2"
          >
            Characters
          </Link>
          <Link
            href="/admin/requests"
            className="hover:bg-accent block rounded-md px-3 py-2"
          >
            Requests
          </Link>
          <Link
            href="/admin/imports"
            className="hover:bg-accent block rounded-md px-3 py-2"
          >
            Imports
          </Link>
        </nav>
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </div>
  );
}
