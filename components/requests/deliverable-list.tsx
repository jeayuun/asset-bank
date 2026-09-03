"use client";

import Link from "next/link";
import { type FormEvent, useState, useTransition } from "react";

import { addDeliverable } from "@/app/(app)/requests/actions";
import { Button } from "@/components/ui/button";

export interface Deliverable {
  id: string;
  label: string;
  assetId: string | null;
  assetTitle: string | null;
  driveUrl: string | null;
  createdAt: string;
}

export function DeliverableList({
  requestId,
  deliverables,
  isAdmin,
}: {
  requestId: string;
  deliverables: Deliverable[];
  isAdmin: boolean;
}) {
  const [label, setLabel] = useState("");
  const [driveUrl, setDriveUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      try {
        await addDeliverable({ requestId, label, driveUrl: driveUrl || null });
        setLabel("");
        setDriveUrl("");
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to add deliverable",
        );
      }
    });
  }

  return (
    <div className="space-y-2">
      <h2 className="text-sm font-semibold">Deliverables</h2>
      {deliverables.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          No deliverables attached yet.
        </p>
      ) : (
        <ul className="space-y-1 text-sm">
          {deliverables.map((deliverable) => (
            <li key={deliverable.id}>
              {deliverable.assetId ? (
                <Link
                  href={`/assets/${deliverable.assetId}`}
                  className="underline"
                >
                  {deliverable.label}
                </Link>
              ) : (
                <a
                  href={deliverable.driveUrl ?? "#"}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline"
                >
                  {deliverable.label}
                </a>
              )}
            </li>
          ))}
        </ul>
      )}

      {isAdmin && (
        <form
          onSubmit={handleSubmit}
          className="flex flex-wrap items-end gap-3"
        >
          <div className="flex flex-col gap-1">
            <label
              htmlFor="deliverable-label"
              className="text-muted-foreground text-xs font-medium"
            >
              Label
            </label>
            <input
              id="deliverable-label"
              type="text"
              required
              value={label}
              onChange={(event) => setLabel(event.target.value)}
              className="border-input bg-background h-9 w-48 rounded-md border px-3 text-sm"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label
              htmlFor="deliverable-url"
              className="text-muted-foreground text-xs font-medium"
            >
              Drive link
            </label>
            <input
              id="deliverable-url"
              type="url"
              value={driveUrl}
              onChange={(event) => setDriveUrl(event.target.value)}
              className="border-input bg-background h-9 w-64 rounded-md border px-3 text-sm"
              placeholder="https://drive.google.com/file/d/…/view"
            />
          </div>
          <Button type="submit" disabled={isPending}>
            {isPending ? "Adding…" : "Attach"}
          </Button>
          {error && (
            <p role="alert" className="text-destructive w-full text-xs">
              {error}
            </p>
          )}
        </form>
      )}
    </div>
  );
}
