"use client";

import { useTransition } from "react";

import { updateLesson } from "@/app/(admin)/admin/curriculum/actions";

export function LessonRowActions({
  lessonId,
  isActive,
}: {
  lessonId: string;
  isActive: boolean;
}) {
  const [isPending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={isPending}
      onClick={() =>
        startTransition(() => updateLesson({ lessonId, isActive: !isActive }))
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
