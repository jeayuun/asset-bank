import type { ReactNode } from "react";
import { redirect } from "next/navigation";

import { AppHeader } from "@/components/shell/app-header";
import { getCurrentProfile } from "@/lib/auth/session";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const profile = await getCurrentProfile();

  if (!profile) {
    redirect("/login");
  }

  return (
    <div className="flex min-h-full flex-col">
      <AppHeader profile={profile} />
      <div className="flex-1">{children}</div>
    </div>
  );
}
