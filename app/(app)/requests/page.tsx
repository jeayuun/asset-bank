import type { Metadata } from "next";
import Link from "next/link";

import { CreateRequestForm } from "@/components/requests/create-request-form";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Requests — Asset Bank",
};

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

export default async function RequestsPage() {
  const supabase = await createClient();

  const [
    { data: requests },
    { data: assetTypes },
    { data: keyStages },
    { data: grades },
    { data: lessons },
  ] = await Promise.all([
    // RLS already scopes this to own + watched requests for a Viewer,
    // and everything for Admin+ (docs/DECISIONS.md D-10).
    supabase
      .from("asset_requests")
      .select("id, reference, title, status, priority, needed_by, created_at")
      .order("created_at", { ascending: false }),
    supabase.from("asset_types").select("id, name").order("sort_order"),
    supabase.from("key_stages").select("id, code").order("sort_order"),
    supabase.from("grades").select("id, label").order("number"),
    supabase
      .from("lessons")
      .select("id, code, title")
      .eq("is_active", true)
      .order("code"),
  ]);

  const rows = requests ?? [];

  return (
    <main className="mx-auto max-w-3xl space-y-8 px-6 py-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Requests</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Requests you created or are watching.
        </p>
      </div>

      <CreateRequestForm
        assetTypes={(assetTypes ?? []).map((a) => ({
          id: a.id,
          label: a.name,
        }))}
        keyStages={(keyStages ?? []).map((k) => ({ id: k.id, label: k.code }))}
        grades={(grades ?? []).map((g) => ({ id: g.id, label: g.label }))}
        lessons={(lessons ?? []).map((l) => ({
          id: l.id,
          label: `${l.code} — ${l.title}`,
        }))}
      />

      <div className="border-border overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-muted text-muted-foreground text-left text-xs uppercase">
            <tr>
              <th className="px-4 py-2">Reference</th>
              <th className="px-4 py-2">Title</th>
              <th className="px-4 py-2">Status</th>
              <th className="px-4 py-2">Priority</th>
              <th className="px-4 py-2">Needed by</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((request) => (
              <tr key={request.id} className="border-border border-t">
                <td className="px-4 py-2 font-mono text-xs">
                  <Link href={`/requests/${request.id}`} className="underline">
                    {request.reference}
                  </Link>
                </td>
                <td className="px-4 py-2">{request.title}</td>
                <td className="px-4 py-2">
                  {STATUS_LABELS[request.status] ?? request.status}
                </td>
                <td className="px-4 py-2 capitalize">{request.priority}</td>
                <td className="px-4 py-2">{request.needed_by ?? "—"}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td
                  colSpan={5}
                  className="text-muted-foreground px-4 py-6 text-center"
                >
                  No requests yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}
