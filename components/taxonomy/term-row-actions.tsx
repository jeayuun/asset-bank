"use client";

import { useState, useTransition } from "react";

import {
  renameTaxonomyTerm,
  setTaxonomyTermActive,
} from "@/app/(super)/super/taxonomy/actions";

export function TermRowActions({
  termId,
  name,
  isActive,
}: {
  termId: string;
  name: string;
  isActive: boolean;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [draftName, setDraftName] = useState(name);
  const [isPending, startTransition] = useTransition();

  if (isEditing) {
    return (
      <div className="flex items-center justify-end gap-2 text-xs">
        <input
          value={draftName}
          onChange={(event) => setDraftName(event.target.value)}
          className="border-input bg-background h-7 w-40 rounded-md border px-2 text-xs"
        />
        <button
          type="button"
          disabled={isPending}
          onClick={() =>
            startTransition(async () => {
              await renameTaxonomyTerm({ termId, name: draftName });
              setIsEditing(false);
            })
          }
          className="text-muted-foreground hover:text-foreground"
        >
          Save
        </button>
        <button
          type="button"
          onClick={() => setIsEditing(false)}
          className="text-muted-foreground hover:text-foreground"
        >
          Cancel
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-end gap-3 text-xs">
      <button
        type="button"
        onClick={() => setIsEditing(true)}
        className="text-muted-foreground hover:text-foreground"
      >
        Rename
      </button>
      <button
        type="button"
        disabled={isPending}
        onClick={() =>
          startTransition(() =>
            setTaxonomyTermActive({ termId, isActive: !isActive }),
          )
        }
        className={
          isActive
            ? "text-destructive hover:opacity-80"
            : "text-muted-foreground hover:text-foreground"
        }
      >
        {isActive ? "Deactivate" : "Reactivate"}
      </button>
    </div>
  );
}
