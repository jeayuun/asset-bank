import type { Metadata } from "next";

import { InviteForm } from "@/components/super/invite-form";
import { createClient } from "@/lib/supabase/server";

import { InvitationActions } from "./invitation-actions";

export const metadata: Metadata = {
  title: "Invitations — Asset Bank",
};

export default async function InvitationsPage() {
  const supabase = await createClient();
  const { data: invitations } = await supabase
    .from("invitations")
    .select("id, email, role, status, expires_at, created_at")
    .order("created_at", { ascending: false });

  const rows = invitations ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Invitations</h1>
        <p className="text-muted-foreground text-sm">
          Invite a Viewer or Admin by their personal Google account email.
        </p>
      </div>

      <InviteForm />

      <div className="border-border overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-muted text-muted-foreground text-left text-xs uppercase">
            <tr>
              <th className="px-4 py-2">Email</th>
              <th className="px-4 py-2">Role</th>
              <th className="px-4 py-2">Status</th>
              <th className="px-4 py-2">Expires</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody>
            {rows.map((invitation) => (
              <tr key={invitation.id} className="border-border border-t">
                <td className="px-4 py-2">{invitation.email}</td>
                <td className="px-4 py-2 capitalize">{invitation.role}</td>
                <td className="px-4 py-2 capitalize">{invitation.status}</td>
                <td className="px-4 py-2">
                  {new Date(invitation.expires_at).toLocaleDateString()}
                </td>
                <td className="px-4 py-2 text-right">
                  {invitation.status === "pending" && (
                    <InvitationActions invitationId={invitation.id} />
                  )}
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td
                  colSpan={5}
                  className="text-muted-foreground px-4 py-6 text-center"
                >
                  No invitations yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
