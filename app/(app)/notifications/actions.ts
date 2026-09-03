"use server";

import { revalidatePath } from "next/cache";

import { requireActive } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import {
  deleteNotificationSchema,
  markNotificationReadSchema,
  setNotificationPreferenceSchema,
} from "@/lib/validation/notifications";

export async function markNotificationRead(input: unknown) {
  const { userId } = await requireActive();
  const { notificationId } = markNotificationReadSchema.parse(input);

  const supabase = await createClient();
  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", notificationId)
    .eq("recipient_id", userId);
  if (error) throw new Error(error.message);

  revalidatePath("/notifications");
}

export async function markAllNotificationsRead() {
  const { userId } = await requireActive();

  const supabase = await createClient();
  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("recipient_id", userId)
    .is("read_at", null);
  if (error) throw new Error(error.message);

  revalidatePath("/notifications");
}

export async function deleteNotification(input: unknown) {
  const { userId } = await requireActive();
  const { notificationId } = deleteNotificationSchema.parse(input);

  const supabase = await createClient();
  const { error } = await supabase
    .from("notifications")
    .delete()
    .eq("id", notificationId)
    .eq("recipient_id", userId);
  if (error) throw new Error(error.message);

  revalidatePath("/notifications");
}

export async function setNotificationPreference(input: unknown) {
  const { userId } = await requireActive();
  const { type, inApp, email } = setNotificationPreferenceSchema.parse(input);

  const supabase = await createClient();
  const { error } = await supabase.from("notification_preferences").upsert({
    profile_id: userId,
    type,
    in_app: inApp,
    email,
  });
  if (error) throw new Error(error.message);

  revalidatePath("/notifications");
}

export async function getUnreadNotificationCount() {
  const { userId } = await requireActive();

  const supabase = await createClient();
  const { count } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("recipient_id", userId)
    .is("read_at", null);

  return count ?? 0;
}
