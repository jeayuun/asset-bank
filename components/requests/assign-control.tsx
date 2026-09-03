"use client";

import { useState, useTransition } from "react";

import { assignRequest } from "@/app/(app)/requests/actions";
import { Button } from "@/components/ui/button";

interface AdminOption {
  id: string;
  label: string;
}

export function AssignControl({
  requestId,
  admins,
  currentAssigneeId,
}: {
  requestId: string;
  admins: AdminOption[];
  currentAssigneeId: string | null;
}) {
  const [assigneeId, setAssigneeId] = useState(currentAssigneeId ?? "");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleAssign() {
    if (!assigneeId) return;
    setError(null);
    startTransition(async () => {
      try {
        await assignRequest({ requestId, assigneeId });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to assign");
      }
    });
  }

  return (
    <div className="flex items-end gap-2">
      <div className="flex flex-col gap-1">
        <label
          htmlFor="assignee"
          className="text-muted-foreground text-xs font-medium"
        >
          Assigned to
        </label>
        <select
          id="assignee"
          value={assigneeId}
          onChange={(event) => setAssigneeId(event.target.value)}
          className="border-input bg-background h-9 rounded-md border px-2 text-sm"
        >
          <option value="">Unassigned</option>
          {admins.map((admin) => (
            <option key={admin.id} value={admin.id}>
              {admin.label}
            </option>
          ))}
        </select>
      </div>
      <Button
        type="button"
        variant="outline"
        disabled={isPending || !assigneeId}
        onClick={handleAssign}
      >
        {isPending ? "Assigning…" : "Assign"}
      </Button>
      {error && (
        <p role="alert" className="text-destructive text-xs">
          {error}
        </p>
      )}
    </div>
  );
}
