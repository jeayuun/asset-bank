"use client";

import { type FormEvent, useState, useTransition } from "react";

import { createLesson } from "@/app/(admin)/admin/curriculum/actions";
import { Button } from "@/components/ui/button";

export function LessonForm({
  gradeId,
  termId,
}: {
  gradeId: string;
  termId: string;
}) {
  const [lessonNumber, setLessonNumber] = useState("");
  const [title, setTitle] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      try {
        await createLesson({
          gradeId,
          termId,
          lessonNumber: Number(lessonNumber),
          title,
        });
        setLessonNumber("");
        setTitle("");
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to create lesson",
        );
      }
    });
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="border-border flex flex-wrap items-end gap-3 rounded-lg border p-4"
    >
      <div className="flex flex-col gap-1">
        <label
          htmlFor="lesson-number"
          className="text-muted-foreground text-xs font-medium"
        >
          Lesson #
        </label>
        <input
          id="lesson-number"
          type="number"
          min={1}
          max={99}
          required
          value={lessonNumber}
          onChange={(event) => setLessonNumber(event.target.value)}
          className="border-input bg-background h-9 w-20 rounded-md border px-3 text-sm"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label
          htmlFor="lesson-title"
          className="text-muted-foreground text-xs font-medium"
        >
          Title
        </label>
        <input
          id="lesson-title"
          type="text"
          required
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          className="border-input bg-background h-9 w-72 rounded-md border px-3 text-sm"
          placeholder="Lesson title"
        />
      </div>
      <Button type="submit" disabled={isPending}>
        {isPending ? "Adding…" : "Add lesson"}
      </Button>
      {error && (
        <p role="alert" className="text-destructive w-full text-xs">
          {error}
        </p>
      )}
    </form>
  );
}
