"use client";

import { useTransition } from "react";

import { reactivateUser, setUserRole, suspendUser } from "./actions";

interface UserRowActionsProps {
  targetId: string;
  role: "viewer" | "admin" | "super_admin";
  status: "active" | "suspended";
  isOwner: boolean;
}

export function UserRowActions({
  targetId,
  role,
  status,
  isOwner,
}: UserRowActionsProps) {
  const [isPending, startTransition] = useTransition();

  if (isOwner) {
    return (
      <span className="text-muted-foreground text-xs">Owner — locked</span>
    );
  }

  function toggleStatus() {
    startTransition(() =>
      status === "active"
        ? suspendUser({ targetId })
        : reactivateUser({ targetId }),
    );
  }

  return (
    <div className="flex items-center justify-end gap-3 text-xs">
      {/* super_admin is never assigned or removed through this UI (D-04) —
          only Viewer/Admin are offered here. */}
      {role !== "super_admin" && (
        <select
          value={role}
          disabled={isPending}
          onChange={(event) =>
            startTransition(() =>
              setUserRole({
                targetId,
                role: event.target.value as "viewer" | "admin",
              }),
            )
          }
          className="border-input bg-background h-8 rounded-md border px-2 text-xs"
        >
          <option value="viewer">Viewer</option>
          <option value="admin">Admin</option>
        </select>
      )}
      <button
        type="button"
        disabled={isPending}
        onClick={toggleStatus}
        className={
          status === "active"
            ? "text-destructive hover:opacity-80"
            : "text-muted-foreground hover:text-foreground"
        }
      >
        {status === "active" ? "Suspend" : "Reactivate"}
      </button>
    </div>
  );
}
