"use client";

import { useTransition } from "react";

import { removeCollectionItem } from "@/app/(app)/collections/actions";

export function RemoveItemButton({
  collectionId,
  assetId,
}: {
  collectionId: string;
  assetId: string;
}) {
  const [isPending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={isPending}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        startTransition(() => removeCollectionItem({ collectionId, assetId }));
      }}
      className="bg-background/90 text-destructive absolute top-2 left-2 rounded-full px-2 py-1 text-xs hover:opacity-80"
    >
      Remove
    </button>
  );
}
