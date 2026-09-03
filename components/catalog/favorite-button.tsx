"use client";

import { useState, useTransition } from "react";

import { toggleFavorite } from "@/app/(app)/actions";
import { cn } from "@/lib/utils";

export function FavoriteButton({
  assetId,
  initialFavorited,
  size = "sm",
}: {
  assetId: string;
  initialFavorited: boolean;
  size?: "sm" | "lg";
}) {
  const [favorited, setFavorited] = useState(initialFavorited);
  const [isPending, startTransition] = useTransition();

  function handleClick(event: React.MouseEvent) {
    event.preventDefault();
    event.stopPropagation();
    const next = !favorited;
    setFavorited(next);
    startTransition(async () => {
      try {
        await toggleFavorite({ assetId });
      } catch {
        setFavorited(!next);
      }
    });
  }

  return (
    <button
      type="button"
      disabled={isPending}
      onClick={handleClick}
      aria-pressed={favorited}
      aria-label={favorited ? "Remove from favorites" : "Add to favorites"}
      className={cn(
        "rounded-full transition-colors",
        favorited
          ? "text-destructive"
          : "text-muted-foreground hover:text-foreground",
        size === "sm" ? "text-lg" : "text-2xl",
      )}
    >
      {favorited ? "♥" : "♡"}
    </button>
  );
}
