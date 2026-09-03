import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { AssignControl } from "@/components/requests/assign-control";
import {
  CommentThread,
  type Comment,
} from "@/components/requests/comment-thread";
import {
  DeliverableList,
  type Deliverable,
} from "@/components/requests/deliverable-list";
import { StatusActions } from "@/components/requests/status-actions";
import { WatcherList, type Watcher } from "@/components/requests/watcher-list";
import { getCurrentProfile } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

const STATUS_LABELS: Record<string, string> = {
  submitted: "Submitted",
  under_review: "Under review",
  approved: "Approved",
  in_progress: "In progress",
  on_hold: "On hold",
  completed: "Completed",
  rejected: "Rejected",
  cancelled: "Cancelled",
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ requestId: string }>;
}): Promise<Metadata> {
  const { requestId } = await params;
  const supabase = await createClient();
  const { data: request } = await supabase
    .from("asset_requests")
    .select("reference, title")
    .eq("id", requestId)
    .maybeSingle();
  return {
    title: request
      ? `${request.reference} — Asset Bank`
      : "Request — Asset Bank",
  };
}

export default async function RequestDetailPage({
  params,
}: {
  params: Promise<{ requestId: string }>;
}) {
  const { requestId } = await params;
  const supabase = await createClient();
  const profile = await getCurrentProfile();

  const { data: request } = await supabase
    .from("asset_requests")
    .select(
      "id, reference, title, description, status, priority, needed_by, requested_by, assigned_to, closed_reason, created_at, asset_types(name), key_stages(code), grades(label), lessons(code, title)",
    )
    .eq("id", requestId)
    .maybeSingle();

  if (!request) {
    notFound();
  }

  const isAdmin =
    profile?.ctx.role === "admin" || profile?.ctx.role === "super_admin";
  const isRequester = profile?.id === request.requested_by;

  const [
    { data: comments },
    { data: deliverables },
    { data: watchers },
    { data: participantEmails },
    { data: admins },
  ] = await Promise.all([
    supabase
      .from("request_comments")
      .select("id, author_id, body, edited_at, deleted_at, created_at")
      .eq("request_id", requestId)
      .order("created_at"),
    supabase
      .from("request_deliverables")
      .select("id, label, asset_id, drive_url, created_at, assets(title)")
      .eq("request_id", requestId)
      .order("created_at"),
    supabase
      .from("request_watchers")
      .select("profile_id")
      .eq("request_id", requestId),
    supabase
      .schema("app")
      .rpc("request_participant_emails", { p_request_id: requestId }),
    isAdmin
      ? supabase
          .from("profiles")
          .select("id, email")
          .in("role", ["admin", "super_admin"])
          .eq("status", "active")
      : Promise.resolve({ data: [] }),
  ]);

  const emailByProfileId = new Map(
    (participantEmails ?? []).map((row) => [row.profile_id, row.email]),
  );

  const commentList: Comment[] = (comments ?? []).map((c) => ({
    id: c.id,
    authorId: c.author_id,
    authorEmail: emailByProfileId.get(c.author_id) ?? "unknown",
    body: c.body,
    editedAt: c.edited_at,
    deletedAt: c.deleted_at,
    createdAt: c.created_at,
  }));

  const deliverableList: Deliverable[] = (deliverables ?? []).map((d) => ({
    id: d.id,
    label: d.label,
    assetId: d.asset_id,
    assetTitle: d.assets?.title ?? null,
    driveUrl: d.drive_url,
    createdAt: d.created_at,
  }));

  const watcherList: Watcher[] = (watchers ?? []).map((w) => ({
    profileId: w.profile_id,
    email: emailByProfileId.get(w.profile_id) ?? "unknown",
  }));

  const requesterEmail =
    emailByProfileId.get(request.requested_by) ?? "unknown";
  const assigneeEmail = request.assigned_to
    ? (emailByProfileId.get(request.assigned_to) ?? "unknown")
    : null;

  return (
    <main className="mx-auto max-w-3xl space-y-6 px-6 py-8">
      <div>
        <p className="text-muted-foreground font-mono text-xs">
          {request.reference}
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">
          {request.title}
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          {STATUS_LABELS[request.status] ?? request.status} ·{" "}
          <span className="capitalize">{request.priority}</span> priority
          {request.needed_by ? ` · needed by ${request.needed_by}` : ""}
        </p>
        <p className="text-muted-foreground mt-1 text-sm">
          Requested by {requesterEmail}
          {assigneeEmail ? ` · Assigned to ${assigneeEmail}` : ""}
        </p>
        {request.closed_reason && (
          <p className="text-muted-foreground mt-1 text-sm">
            Note: {request.closed_reason}
          </p>
        )}
      </div>

      {request.description && <p className="text-sm">{request.description}</p>}

      <div className="space-y-1 text-sm">
        {request.asset_types && (
          <p>
            <span className="text-muted-foreground">Asset type: </span>
            {request.asset_types.name}
          </p>
        )}
        {request.key_stages && (
          <p>
            <span className="text-muted-foreground">Key Stage: </span>
            {request.key_stages.code}
          </p>
        )}
        {request.grades && (
          <p>
            <span className="text-muted-foreground">Grade: </span>
            {request.grades.label}
          </p>
        )}
        {request.lessons && (
          <p>
            <span className="text-muted-foreground">Lesson: </span>
            {request.lessons.code} — {request.lessons.title}
          </p>
        )}
      </div>

      {profile && (
        <StatusActions
          requestId={request.id}
          status={request.status}
          isAdmin={isAdmin}
          isRequester={isRequester}
        />
      )}

      {isAdmin && (
        <AssignControl
          requestId={request.id}
          admins={(admins ?? []).map((a) => ({ id: a.id, label: a.email }))}
          currentAssigneeId={request.assigned_to}
        />
      )}

      <DeliverableList
        requestId={request.id}
        deliverables={deliverableList}
        isAdmin={isAdmin}
      />

      <WatcherList
        requestId={request.id}
        watchers={watcherList}
        isAdmin={isAdmin}
      />

      {profile && (
        <CommentThread
          requestId={request.id}
          comments={commentList}
          currentUserId={profile.id}
          isAdmin={isAdmin}
        />
      )}
    </main>
  );
}
