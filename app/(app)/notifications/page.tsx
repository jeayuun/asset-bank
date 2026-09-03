import type { Metadata } from "next";

import { NotificationList } from "@/components/notifications/notification-list";
import { PreferencesForm } from "@/components/notifications/preferences-form";
import { getCurrentProfile } from "@/lib/auth/session";
import { notificationTypes } from "@/lib/validation/notifications";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Notifications — Asset Bank",
};

export default async function NotificationsPage() {
  const supabase = await createClient();
  const profile = await getCurrentProfile();

  const [{ data: notifications }, { data: preferenceRows }] = await Promise.all(
    [
      profile
        ? supabase
            .from("notifications")
            .select(
              "id, title, body, url, read_at, created_at, email_status, email_error",
            )
            .order("created_at", { ascending: false })
            .limit(100)
        : Promise.resolve({ data: [] }),
      profile
        ? supabase
            .from("notification_preferences")
            .select("type, in_app, email")
            .eq("profile_id", profile.id)
        : Promise.resolve({ data: [] }),
    ],
  );

  const preferenceByType = new Map(
    (preferenceRows ?? []).map((row) => [row.type, row]),
  );
  const preferences = notificationTypes.map((type) => {
    const existing = preferenceByType.get(type);
    return {
      type,
      inApp: existing?.in_app ?? true,
      email: existing?.email ?? true,
    };
  });

  return (
    <main className="mx-auto max-w-3xl space-y-8 px-6 py-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Notifications</h1>
      </div>

      <NotificationList
        notifications={(notifications ?? []).map((n) => ({
          id: n.id,
          title: n.title,
          body: n.body,
          url: n.url,
          readAt: n.read_at,
          createdAt: n.created_at,
          emailStatus: n.email_status,
          emailError: n.email_error,
        }))}
      />

      <PreferencesForm preferences={preferences} />
    </main>
  );
}
