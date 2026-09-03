import Link from "next/link";

import { Logo } from "@/components/brand/logo";
import { NotificationBell } from "@/components/shell/notification-bell";
import { signOut } from "@/lib/auth/actions";
import type { SessionProfile } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

export async function AppHeader({ profile }: { profile: SessionProfile }) {
  const supabase = await createClient();
  const { count: unreadCount } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("recipient_id", profile.id)
    .is("read_at", null);

  return (
    <header className="border-border flex items-center justify-between border-b px-6 py-4">
      <Link href="/" className="flex items-center gap-2">
        <Logo />
        <span className="text-sm font-semibold">Asset Bank</span>
      </Link>
      <div className="flex items-center gap-4 text-sm">
        <Link
          href="/favorites"
          className="text-muted-foreground hover:text-foreground"
        >
          Favorites
        </Link>
        <Link
          href="/collections"
          className="text-muted-foreground hover:text-foreground"
        >
          Collections
        </Link>
        <Link
          href="/requests"
          className="text-muted-foreground hover:text-foreground"
        >
          Requests
        </Link>
        <NotificationBell initialCount={unreadCount ?? 0} />
        {profile.ctx.role !== "viewer" && (
          <Link
            href="/admin/curriculum"
            className="text-muted-foreground hover:text-foreground"
          >
            Curriculum
          </Link>
        )}
        {profile.ctx.role === "super_admin" && (
          <Link
            href="/super/users"
            className="text-muted-foreground hover:text-foreground"
          >
            Admin
          </Link>
        )}
        <span className="text-muted-foreground">
          {profile.fullName ?? profile.email}
        </span>
        <form action={signOut}>
          <button
            type="submit"
            className="text-muted-foreground hover:text-foreground"
          >
            Sign out
          </button>
        </form>
      </div>
    </header>
  );
}
