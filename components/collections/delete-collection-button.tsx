"use client";

import { useState, useTransition } from "react";

import { deleteCollection } from "@/app/(app)/collections/actions";
import { Button } from "@/components/ui/button";

export function DeleteCollectionButton({
  collectionId,
}: {
  collectionId: string;
}) {
  const [confirming, setConfirming] = useState(false);
  const [isPending, startTransition] = useTransition();

  if (!confirming) {
    return (
      <Button
        type="button"
        variant="outline"
        onClick={() => setConfirming(true)}
      >
        Delete collection
      </Button>
    );
  }

  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="text-muted-foreground">Delete this collection?</span>
      <Button
        type="button"
        disabled={isPending}
        onClick={() =>
          startTransition(() => deleteCollection({ collectionId }))
        }
      >
        {isPending ? "Deleting…" : "Confirm delete"}
      </Button>
      <Button
        type="button"
        variant="outline"
        disabled={isPending}
        onClick={() => setConfirming(false)}
      >
        Cancel
      </Button>
    </div>
  );
}
