"use client";

import { useState, useTransition } from "react";

import { commitImportBatch } from "@/app/(admin)/admin/imports/actions";
import { Button } from "@/components/ui/button";

export function CommitButton({
  batchId,
  includedCount,
}: {
  batchId: string;
  includedCount: number;
}) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  return (
    <div className="space-y-2">
      <Button
        type="button"
        disabled={isPending || includedCount === 0}
        onClick={() => {
          setError(null);
          startTransition(async () => {
            try {
              await commitImportBatch({ batchId });
            } catch (err) {
              setError(err instanceof Error ? err.message : "Commit failed");
            }
          });
        }}
      >
        {isPending
          ? "Committing…"
          : `Commit ${includedCount} row${includedCount === 1 ? "" : "s"} as drafts`}
      </Button>
      {error && (
        <p role="alert" className="text-destructive text-xs">
          {error}
        </p>
      )}
    </div>
  );
}
