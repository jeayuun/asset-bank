"use client";

import { useTransition } from "react";

import { setCharacterProfileActive } from "@/app/(admin)/admin/characters/actions";

export function CharacterProfileRowActions({
  profileId,
  isActive,
}: {
  profileId: string;
  isActive: boolean;
}) {
  const [isPending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={isPending}
      onClick={() =>
        startTransition(() =>
          setCharacterProfileActive({ profileId, isActive: !isActive }),
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
  );
}
