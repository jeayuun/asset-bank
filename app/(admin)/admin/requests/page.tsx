import type { Metadata } from "next";
import Link from "next/link";

import { requestPriorities, requestStatuses } from "@/lib/validation/requests";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Requests — Asset Bank",
};

const STATUS_ORDER = requestStatuses;

function isStatus(value: string): value is (typeof requestStatuses)[number] {
  return (requestStatuses as readonly string[]).includes(value);
}

function isPriority(
  value: string,
): value is (typeof requestPriorities)[number] {
  return (requestPriorities as readonly string[]).includes(value);
}

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

interface RequestRow {
  id: string;
  reference: string;
  title: string;
  status: string;
  priority: string;
  needed_by: string | null;
  requested_by_profile: { email: string } | null;
  assigned_to_profile: { email: string } | null;
  key_stages: { code: string } | null;
  grades: { label: string } | null;
}

export default async function AdminRequestsPage({
  searchParams,
}: {
  searchParams: Promise<{
    status?: string;
    assignee?: string;
    priority?: string;
    keyStage?: string;
    grade?: string;
    overdue?: string;
  }>;
}) {
  const params = await searchParams;
  const supabase = await createClient();

  const [{ data: admins }, { data: keyStages }, { data: grades }] =
    await Promise.all([
      supabase
        .from("profiles")
        .select("id, email")
        .in("role", ["admin", "super_admin"])
        .eq("status", "active")
        .order("email"),
      supabase.from("key_stages").select("id, code").order("sort_order"),
      supabase.from("grades").select("id, label").order("number"),
    ]);

  let query = supabase
    .from("asset_requests")
    .select(
      "id, reference, title, status, priority, needed_by, requested_by_profile:profiles!asset_requests_requested_by_fkey(email), assigned_to_profile:profiles!asset_requests_assigned_to_fkey(email), key_stages(code), grades(label)",
    );

  if (params.status && isStatus(params.status)) {
    query = query.eq("status", params.status);
  }
  if (params.assignee) query = query.eq("assigned_to", params.assignee);
  if (params.priority && isPriority(params.priority)) {
    query = query.eq("priority", params.priority);
  }
  if (params.keyStage) query = query.eq("key_stage_id", params.keyStage);
  if (params.grade) query = query.eq("grade_id", params.grade);
  if (params.overdue === "1") {
    query = query
      .lt("needed_by", new Date().toISOString().slice(0, 10))
      .not("status", "in", "(completed,rejected,cancelled)");
  }

  const { data: requests } = await query.order("created_at", {
    ascending: false,
  });

  const rows = (requests ?? []) as unknown as RequestRow[];
  const byStatus = new Map<string, RequestRow[]>();
  for (const row of rows) {
    const list = byStatus.get(row.status) ?? [];
    list.push(row);
    byStatus.set(row.status, list);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Requests</h1>
        <p className="text-muted-foreground text-sm">
          Every request, grouped by status.
        </p>
      </div>

      <form method="get" className="flex flex-wrap gap-3">
        <select
          name="status"
          defaultValue={params.status ?? ""}
          className="border-input bg-background h-9 rounded-md border px-2 text-sm"
        >
          <option value="">All statuses</option>
          {STATUS_ORDER.map((status) => (
            <option key={status} value={status}>
              {STATUS_LABELS[status]}
            </option>
          ))}
        </select>
        <select
          name="assignee"
          defaultValue={params.assignee ?? ""}
          className="border-input bg-background h-9 rounded-md border px-2 text-sm"
        >
          <option value="">Any assignee</option>
          {(admins ?? []).map((admin) => (
            <option key={admin.id} value={admin.id}>
              {admin.email}
            </option>
          ))}
        </select>
        <select
          name="priority"
          defaultValue={params.priority ?? ""}
          className="border-input bg-background h-9 rounded-md border px-2 text-sm"
        >
          <option value="">Any priority</option>
          <option value="low">Low</option>
          <option value="normal">Normal</option>
          <option value="high">High</option>
          <option value="urgent">Urgent</option>
        </select>
        <select
          name="keyStage"
          defaultValue={params.keyStage ?? ""}
          className="border-input bg-background h-9 rounded-md border px-2 text-sm"
        >
          <option value="">Any Key Stage</option>
          {(keyStages ?? []).map((ks) => (
            <option key={ks.id} value={ks.id}>
              {ks.code}
            </option>
          ))}
        </select>
        <select
          name="grade"
          defaultValue={params.grade ?? ""}
          className="border-input bg-background h-9 rounded-md border px-2 text-sm"
        >
          <option value="">Any grade</option>
          {(grades ?? []).map((grade) => (
            <option key={grade.id} value={grade.id}>
              {grade.label}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-1.5 text-sm">
          <input
            type="checkbox"
            name="overdue"
            value="1"
            defaultChecked={params.overdue === "1"}
          />
          Overdue only
        </label>
        <button
          type="submit"
          className="border-input hover:bg-accent h-9 rounded-md border px-3 text-sm"
        >
          Filter
        </button>
      </form>

      {rows.length === 0 && (
        <p className="text-muted-foreground text-sm">
          No requests match these filters.
        </p>
      )}

      {STATUS_ORDER.filter((status) => byStatus.has(status)).map((status) => (
        <section key={status} className="space-y-2">
          <h2 className="text-sm font-semibold">
            {STATUS_LABELS[status]} ({byStatus.get(status)!.length})
          </h2>
          <div className="border-border overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead className="bg-muted text-muted-foreground text-left text-xs uppercase">
                <tr>
                  <th className="px-4 py-2">Reference</th>
                  <th className="px-4 py-2">Title</th>
                  <th className="px-4 py-2">Requested by</th>
                  <th className="px-4 py-2">Assigned to</th>
                  <th className="px-4 py-2">Priority</th>
                  <th className="px-4 py-2">Needed by</th>
                </tr>
              </thead>
              <tbody>
                {byStatus.get(status)!.map((request) => (
                  <tr key={request.id} className="border-border border-t">
                    <td className="px-4 py-2 font-mono text-xs">
                      <Link
                        href={`/requests/${request.id}`}
                        className="underline"
                      >
                        {request.reference}
                      </Link>
                    </td>
                    <td className="px-4 py-2">{request.title}</td>
                    <td className="px-4 py-2">
                      {request.requested_by_profile?.email ?? "—"}
                    </td>
                    <td className="px-4 py-2">
                      {request.assigned_to_profile?.email ?? "Unassigned"}
                    </td>
                    <td className="px-4 py-2 capitalize">{request.priority}</td>
                    <td className="px-4 py-2">{request.needed_by ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ))}
    </div>
  );
}
