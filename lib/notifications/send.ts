import "server-only";

import { Resend } from "resend";

import { notificationEmail } from "@/emails/notification";
import { env } from "@/lib/env";
import type { createClient } from "@/lib/supabase/server";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

/**
 * Sends email for any notification rows created by the triggers in
 * supabase/migrations/20260901130000_notifications.sql as a side effect
 * of the mutation at (entityType, entityId) since `since` — a timestamp
 * captured just before that mutation ran. Failures never throw: a
 * failure is recorded on the notification row and audited
 * (docs/DECISIONS.md D-12), but must not roll back or interrupt the
 * business action that triggered it.
 *
 * The lookup goes through app.pending_notification_emails_for_entity()
 * rather than a plain `.from("notifications")` query — the caller here
 * is the *actor* (whoever changed the status, commented, etc.), and the
 * actual recipients (watchers, an assignee) are almost always someone
 * else. A plain query would run under the actor's own RLS session and
 * see none of the rows it just caused the trigger to create.
 *
 * Correlating by (entity, timestamp) rather than having the triggering
 * RPC return notification ids directly avoids changing
 * app.change_request_status()'s already-shipped signature (migrations
 * are forward-only). The tiny collision window this leaves — a prior
 * call's email send crashing mid-flight and leaving a stale 'pending'
 * row that a later call's window happens to catch — is an accepted
 * first-version limitation, consistent with D-12's own "no outbox, some
 * emails may be lost" design.
 */
export async function sendPendingNotificationEmails(
  supabase: SupabaseServerClient,
  params: { entityType: string; entityId: string; since: string },
) {
  const { data: pending } = await supabase
    .schema("app")
    .rpc("pending_notification_emails_for_entity", {
      p_entity_type: params.entityType,
      p_entity_id: params.entityId,
      p_since: params.since,
    });

  if (!pending || pending.length === 0) return;

  const resend = new Resend(env.RESEND_API_KEY);

  for (const notification of pending) {
    const { subject, text, html } = notificationEmail({
      title: notification.title,
      body: notification.body,
      url: `${env.NEXT_PUBLIC_SITE_URL}${notification.url ?? "/notifications"}`,
    });

    try {
      const { error } = await resend.emails.send({
        from: env.RESEND_FROM_EMAIL,
        to: notification.recipient_email,
        subject,
        text,
        html,
      });
      if (error) throw new Error(error.message);

      await supabase.schema("app").rpc("record_notification_email_result", {
        p_notification_id: notification.id,
        p_success: true,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      console.error("Notification email failed to send:", message);
      await supabase.schema("app").rpc("record_notification_email_result", {
        p_notification_id: notification.id,
        p_success: false,
        p_error: message,
      });
    }
  }
}
