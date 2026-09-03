"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireActive, requireRole } from "@/lib/auth/guards";
import { sendPendingNotificationEmails } from "@/lib/notifications/send";
import { createClient } from "@/lib/supabase/server";
import {
  addCommentSchema,
  addDeliverableSchema,
  addWatcherByEmailSchema,
  assignRequestSchema,
  changeRequestStatusSchema,
  createRequestSchema,
  deleteCommentSchema,
  editCommentSchema,
  removeWatcherSchema,
} from "@/lib/validation/requests";

export async function createRequest(input: unknown) {
  const { userId } = await requireActive();
  const parsed = createRequestSchema.parse(input);

  const supabase = await createClient();
  // asset_requests' own SELECT policy (app.can_see_request()) looks
  // itself up by id, and Postgres checks INSERT...RETURNING rows against
  // SELECT policies using a snapshot from the start of the statement —
  // so a self-referential check like this one can't see the row it's
  // checking yet, and RETURNING would fail with a spurious RLS error on
  // every single request submission. Generating the id here and skipping
  // RETURNING avoids that snapshot-timing edge case entirely.
  const id = crypto.randomUUID();
  const { error } = await supabase.from("asset_requests").insert({
    id,
    // Always overwritten by app.set_request_reference() — the column is
    // NOT NULL with no DB default (docs/DECISIONS.md D-09's reasoning),
    // so the insert payload needs a placeholder.
    reference: "",
    title: parsed.title,
    description: parsed.description ?? null,
    asset_type_id: parsed.assetTypeId ?? null,
    key_stage_id: parsed.keyStageId ?? null,
    grade_id: parsed.gradeId ?? null,
    lesson_id: parsed.lessonId ?? null,
    priority: parsed.priority,
    needed_by: parsed.neededBy || null,
    requested_by: userId,
  });

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/requests");
  redirect(`/requests/${id}`);
}

export async function changeRequestStatus(input: unknown) {
  await requireActive();
  const { requestId, newStatus, note } = changeRequestStatusSchema.parse(input);

  const supabase = await createClient();
  const since = new Date().toISOString();
  const { error } = await supabase.schema("app").rpc("change_request_status", {
    p_request_id: requestId,
    p_new_status: newStatus,
    p_note: note ?? undefined,
  });
  if (error) throw new Error(error.message);

  await sendPendingNotificationEmails(supabase, {
    entityType: "asset_request",
    entityId: requestId,
    since,
  });

  revalidatePath(`/requests/${requestId}`);
  revalidatePath("/requests");
  revalidatePath("/admin/requests");
}

export async function assignRequest(input: unknown) {
  await requireRole("admin");
  const { requestId, assigneeId } = assignRequestSchema.parse(input);

  const supabase = await createClient();
  const since = new Date().toISOString();
  const { error } = await supabase.schema("app").rpc("assign_request", {
    p_request_id: requestId,
    p_assignee_id: assigneeId,
  });
  if (error) throw new Error(error.message);

  await sendPendingNotificationEmails(supabase, {
    entityType: "asset_request",
    entityId: requestId,
    since,
  });

  revalidatePath(`/requests/${requestId}`);
  revalidatePath("/admin/requests");
}

export async function addComment(input: unknown) {
  const { userId } = await requireActive();
  const { requestId, body } = addCommentSchema.parse(input);

  const supabase = await createClient();
  const { data: comment, error } = await supabase
    .from("request_comments")
    .insert({ request_id: requestId, author_id: userId, body })
    .select("id")
    .single();
  if (error || !comment) {
    throw new Error(error?.message ?? "Failed to post comment");
  }

  await sendPendingNotificationEmails(supabase, {
    entityType: "request_comment",
    entityId: comment.id,
    since: new Date(0).toISOString(),
  });

  revalidatePath(`/requests/${requestId}`);
}

export async function editComment(input: unknown) {
  await requireActive();
  const { commentId, body } = editCommentSchema.parse(input);

  const supabase = await createClient();
  const { data: comment, error } = await supabase
    .from("request_comments")
    .update({ body, edited_at: new Date().toISOString() })
    .eq("id", commentId)
    .select("request_id")
    .single();
  if (error) throw new Error(error.message);

  revalidatePath(`/requests/${comment.request_id}`);
}

export async function deleteComment(input: unknown) {
  await requireActive();
  const { commentId } = deleteCommentSchema.parse(input);

  const supabase = await createClient();
  const { data: comment, error } = await supabase
    .from("request_comments")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", commentId)
    .select("request_id")
    .single();
  if (error) throw new Error(error.message);

  revalidatePath(`/requests/${comment.request_id}`);
}

export async function addDeliverable(input: unknown) {
  const { userId } = await requireRole("admin");
  const parsed = addDeliverableSchema.parse(input);

  const supabase = await createClient();
  const { error } = await supabase.from("request_deliverables").insert({
    request_id: parsed.requestId,
    label: parsed.label,
    asset_id: parsed.assetId ?? null,
    drive_url: parsed.driveUrl ?? null,
    added_by: userId,
  });
  if (error) throw new Error(error.message);

  revalidatePath(`/requests/${parsed.requestId}`);
}

export async function addWatcherByEmail(input: unknown) {
  await requireRole("admin");
  const { requestId, email } = addWatcherByEmailSchema.parse(input);

  const supabase = await createClient();
  const { data: profileId, error: lookupError } = await supabase
    .schema("app")
    .rpc("find_profile_id_by_email", { p_email: email });
  if (lookupError) throw new Error(lookupError.message);
  if (!profileId) throw new Error("No active user found with that email");

  const { error } = await supabase
    .from("request_watchers")
    .insert({ request_id: requestId, profile_id: profileId });
  if (error) throw new Error(error.message);

  revalidatePath(`/requests/${requestId}`);
}

export async function removeWatcher(input: unknown) {
  await requireRole("admin");
  const { requestId, profileId } = removeWatcherSchema.parse(input);

  const supabase = await createClient();
  const { error } = await supabase
    .from("request_watchers")
    .delete()
    .eq("request_id", requestId)
    .eq("profile_id", profileId);
  if (error) throw new Error(error.message);

  revalidatePath(`/requests/${requestId}`);
}
