import type { Metadata } from "next";

import { createClient } from "@/lib/supabase/server";

import { UserRowActions } from "./user-row-actions";

export const metadata: Metadata = {
  title: "Users — Asset Bank",
};

export default async function UsersPage() {
  const supabase = await createClient();

  const [{ data: profiles }, { data: unrecognized }] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, email, full_name, role, status, is_owner, created_at")
      .order("created_at", { ascending: true }),
    supabase.schema("app").rpc("unrecognized_sign_ins"),
  ]);

  const rows = profiles ?? [];
  const unrecognizedRows = unrecognized ?? [];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Users</h1>
        <p className="text-muted-foreground text-sm">
          Change roles, suspend, or reactivate. The Owner row is locked.
        </p>
      </div>

      <div className="border-border overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-muted text-muted-foreground text-left text-xs uppercase">
            <tr>
              <th className="px-4 py-2">Name</th>
              <th className="px-4 py-2">Email</th>
              <th className="px-4 py-2">Status</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody>
            {rows.map((profile) => (
              <tr key={profile.id} className="border-border border-t">
                <td className="px-4 py-2">{profile.full_name ?? "—"}</td>
                <td className="px-4 py-2">{profile.email}</td>
                <td className="px-4 py-2 capitalize">{profile.status}</td>
                <td className="px-4 py-2 text-right">
                  <UserRowActions
                    targetId={profile.id}
                    role={profile.role}
                    status={profile.status}
                    isOwner={profile.is_owner}
                  />
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td
                  colSpan={4}
                  className="text-muted-foreground px-4 py-6 text-center"
                >
                  No users yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {unrecognizedRows.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold">
            Unrecognized sign-in attempts
          </h2>
          <p className="text-muted-foreground mt-1 text-xs">
            These Google accounts signed in but had no matching invitation and
            have no access. Invite them if this was expected.
          </p>
          <div className="border-border mt-3 overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <tbody>
                {unrecognizedRows.map((row) => (
                  <tr
                    key={row.id}
                    className="border-border border-t first:border-t-0"
                  >
                    <td className="px-4 py-2">{row.email}</td>
                    <td className="text-muted-foreground px-4 py-2">
                      {new Date(row.created_at).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
