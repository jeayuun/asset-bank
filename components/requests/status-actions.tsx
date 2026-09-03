"use client";

import { useState, useTransition } from "react";

import { changeRequestStatus } from "@/app/(app)/requests/actions";
import { Button } from "@/components/ui/button";

type RequestStatus =
  | "submitted"
  | "under_review"
  | "approved"
  | "in_progress"
  | "on_hold"
  | "completed"
  | "rejected"
  | "cancelled";

const STATUS_LABELS: Record<RequestStatus, string> = {
  submitted: "Submitted",
  under_review: "Under review",
  approved: "Approved",
  in_progress: "In progress",
  on_hold: "On hold",
  completed: "Completed",
  rejected: "Rejected",
  cancelled: "Cancelled",
};

// Mirrors app.change_request_status()'s transition matrix — the database
// is the real enforcement (docs/BLUEPRINT.md §9); this only decides which
// buttons to offer.
function nextStatuses(
  status: RequestStatus,
  isAdmin: boolean,
  isRequester: boolean,
): RequestStatus[] {
  const options: RequestStatus[] = [];
  if (status === "submitted") {
    if (isAdmin) options.push("under_review");
    if (isAdmin || isRequester) options.push("cancelled");
  } else if (status === "under_review") {
    if (isAdmin) options.push("approved", "rejected");
    if (isAdmin || isRequester) options.push("cancelled");
  } else if (status === "approved") {
    if (isAdmin) options.push("in_progress", "rejected");
  } else if (status === "in_progress") {
    if (isAdmin) options.push("completed", "on_hold");
  } else if (status === "on_hold") {
    if (isAdmin) options.push("in_progress");
  } else if (["completed", "rejected", "cancelled"].includes(status)) {
    if (isAdmin) options.push("under_review");
  }
  return options;
}

const NOTE_REQUIRED: RequestStatus[] = ["rejected", "on_hold"];

export function StatusActions({
  requestId,
  status,
  isAdmin,
  isRequester,
}: {
  requestId: string;
  status: RequestStatus;
  isAdmin: boolean;
  isRequester: boolean;
}) {
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const options = nextStatuses(status, isAdmin, isRequester);
  if (options.length === 0) return null;

  function handleClick(newStatus: RequestStatus) {
    setError(null);
    startTransition(async () => {
      try {
        await changeRequestStatus({ requestId, newStatus, note: note || null });
        setNote("");
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to change status",
        );
      }
    });
  }

  const anyRequireNote = options.some((option) =>
    NOTE_REQUIRED.includes(option),
  );

  return (
    <div className="space-y-2">
      {anyRequireNote && (
        <div className="flex flex-col gap-1">
          <label
            htmlFor="status-note"
            className="text-muted-foreground text-xs font-medium"
          >
            Note (required for rejecting or putting on hold)
          </label>
          <textarea
            id="status-note"
            value={note}
            onChange={(event) => setNote(event.target.value)}
            rows={2}
            className="border-input bg-background rounded-md border px-3 py-2 text-sm"
          />
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        {options.map((option) => (
          <Button
            key={option}
            type="button"
            variant={
              option === "cancelled" || option === "rejected"
                ? "outline"
                : "default"
            }
            disabled={isPending}
            onClick={() => handleClick(option)}
          >
            Move to {STATUS_LABELS[option]}
          </Button>
        ))}
      </div>
      {error && (
        <p role="alert" className="text-destructive text-xs">
          {error}
        </p>
      )}
    </div>
  );
}
