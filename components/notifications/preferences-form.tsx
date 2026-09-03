"use client";

import { useState, useTransition } from "react";

import { setNotificationPreference } from "@/app/(app)/notifications/actions";
import { notificationTypes } from "@/lib/validation/notifications";

const TYPE_LABELS: Record<(typeof notificationTypes)[number], string> = {
  request_status_changed: "A request you're watching changes status",
  request_assigned: "You're assigned to a request",
  request_comment: "Someone comments on a request you're watching",
};

export interface PreferenceRow {
  type: (typeof notificationTypes)[number];
  inApp: boolean;
  email: boolean;
}

export function PreferencesForm({
  preferences,
}: {
  preferences: PreferenceRow[];
}) {
  const [rows, setRows] = useState(preferences);
  const [isPending, startTransition] = useTransition();

  function update(
    type: (typeof notificationTypes)[number],
    field: "inApp" | "email",
    value: boolean,
  ) {
    const next = rows.map((row) =>
      row.type === type ? { ...row, [field]: value } : row,
    );
    setRows(next);
    const row = next.find((r) => r.type === type)!;
    startTransition(() =>
      setNotificationPreference({
        type,
        inApp: row.inApp,
        email: row.email,
      }),
    );
  }

  return (
    <div className="space-y-2">
      <h2 className="text-sm font-semibold">Notification preferences</h2>
      <div className="border-border overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-muted text-muted-foreground text-left text-xs uppercase">
            <tr>
              <th className="px-4 py-2">Event</th>
              <th className="px-4 py-2">In-app</th>
              <th className="px-4 py-2">Email</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.type} className="border-border border-t">
                <td className="px-4 py-2">{TYPE_LABELS[row.type]}</td>
                <td className="px-4 py-2">
                  <input
                    type="checkbox"
                    disabled={isPending}
                    checked={row.inApp}
                    onChange={(event) =>
                      update(row.type, "inApp", event.target.checked)
                    }
                  />
                </td>
                <td className="px-4 py-2">
                  <input
                    type="checkbox"
                    disabled={isPending}
                    checked={row.email}
                    onChange={(event) =>
                      update(row.type, "email", event.target.checked)
                    }
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
