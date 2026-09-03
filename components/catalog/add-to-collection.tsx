"use client";

import Link from "next/link";
import { useState, useTransition } from "react";

import {
  addCollectionItem,
  removeCollectionItem,
} from "@/app/(app)/collections/actions";

interface CollectionOption {
  id: string;
  name: string;
}

export function AddToCollection({
  assetId,
  editableCollections,
  initialCollectionIds,
}: {
  assetId: string;
  editableCollections: CollectionOption[];
  initialCollectionIds: string[];
}) {
  const [memberIds, setMemberIds] = useState<Set<string>>(
    new Set(initialCollectionIds),
  );
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function toggle(collectionId: string) {
    const wasMember = memberIds.has(collectionId);
    setError(null);
    setMemberIds((current) => {
      const next = new Set(current);
      if (wasMember) next.delete(collectionId);
      else next.add(collectionId);
      return next;
    });
    startTransition(async () => {
      try {
        if (wasMember) {
          await removeCollectionItem({ collectionId, assetId });
        } else {
          await addCollectionItem({ collectionId, assetId });
        }
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to update collection",
        );
        setMemberIds((current) => {
          const reverted = new Set(current);
          if (wasMember) reverted.add(collectionId);
          else reverted.delete(collectionId);
          return reverted;
        });
      }
    });
  }

  if (editableCollections.length === 0) {
    return (
      <p className="text-muted-foreground text-xs">
        You don&apos;t have any collections yet. Create one on the{" "}
        <Link href="/collections" className="underline">
          Collections
        </Link>{" "}
        page.
      </p>
    );
  }

  return (
    <div className="space-y-1">
      <span className="text-muted-foreground text-xs font-medium">
        Add to collection
      </span>
      <div className="flex flex-wrap gap-3">
        {editableCollections.map((collection) => (
          <label
            key={collection.id}
            className="flex items-center gap-1.5 text-sm"
          >
            <input
              type="checkbox"
              disabled={isPending}
              checked={memberIds.has(collection.id)}
              onChange={() => toggle(collection.id)}
            />
            {collection.name}
          </label>
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
