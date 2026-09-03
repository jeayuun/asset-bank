"use client";

import { useMemo, useState, useTransition } from "react";

import { assignAssetLessons } from "@/app/(admin)/admin/assets/actions";
import { Button } from "@/components/ui/button";

interface Grade {
  id: string;
  number: number;
  label: string;
}

interface Term {
  id: string;
  number: number;
  label: string;
}

interface Lesson {
  id: string;
  gradeId: string;
  termId: string;
  code: string;
  title: string;
}

// The lesson assignment interface follows a fixed order — grade, then
// term, then one or more lessons (docs/PRODUCT_SPEC.md §7). asset_grades
// is derived from whichever lessons end up selected, not chosen directly.
export function LessonAssignment({
  assetId,
  grades,
  terms,
  lessons,
  initialLessonIds,
}: {
  assetId: string;
  grades: Grade[];
  terms: Term[];
  lessons: Lesson[];
  initialLessonIds: string[];
}) {
  const [gradeId, setGradeId] = useState(grades[0]?.id ?? "");
  const [termId, setTermId] = useState(terms[0]?.id ?? "");
  const [selectedLessonIds, setSelectedLessonIds] = useState<Set<string>>(
    new Set(initialLessonIds),
  );
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const visibleLessons = useMemo(
    () =>
      lessons.filter(
        (lesson) => lesson.gradeId === gradeId && lesson.termId === termId,
      ),
    [lessons, gradeId, termId],
  );

  const selectedLessons = useMemo(
    () => lessons.filter((lesson) => selectedLessonIds.has(lesson.id)),
    [lessons, selectedLessonIds],
  );

  function toggleLesson(id: string) {
    setSelectedLessonIds((current) => {
      const next = new Set(current);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function handleSave() {
    setError(null);
    startTransition(async () => {
      try {
        await assignAssetLessons({
          assetId,
          lessonIds: [...selectedLessonIds],
        });
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to save lesson usage",
        );
      }
    });
  }

  return (
    <div className="space-y-2">
      <h2 className="text-sm font-semibold">Lesson usage</h2>
      <p className="text-muted-foreground text-xs">
        Assets not tied to any lesson must still carry at least one Key Stage
        (already handled above).
      </p>
      <div className="flex gap-3">
        <select
          value={gradeId}
          onChange={(event) => setGradeId(event.target.value)}
          className="border-input bg-background h-9 rounded-md border px-2 text-sm"
        >
          {grades.map((grade) => (
            <option key={grade.id} value={grade.id}>
              {grade.label}
            </option>
          ))}
        </select>
        <select
          value={termId}
          onChange={(event) => setTermId(event.target.value)}
          className="border-input bg-background h-9 rounded-md border px-2 text-sm"
        >
          {terms.map((term) => (
            <option key={term.id} value={term.id}>
              {term.label}
            </option>
          ))}
        </select>
      </div>
      <div className="border-border max-h-48 space-y-1 overflow-y-auto rounded-md border p-3">
        {visibleLessons.length === 0 && (
          <p className="text-muted-foreground text-xs">
            No lessons yet for this grade and term.
          </p>
        )}
        {visibleLessons.map((lesson) => (
          <label key={lesson.id} className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={selectedLessonIds.has(lesson.id)}
              onChange={() => toggleLesson(lesson.id)}
            />
            <span className="font-mono text-xs">{lesson.code}</span>
            {lesson.title}
          </label>
        ))}
      </div>
      {selectedLessons.length > 0 && (
        <p className="text-muted-foreground text-xs">
          Assigned to: {selectedLessons.map((l) => l.code).join(", ")}
        </p>
      )}
      <Button
        type="button"
        variant="outline"
        disabled={isPending}
        onClick={handleSave}
      >
        {isPending ? "Saving…" : "Save lesson usage"}
      </Button>
      {error && (
        <p role="alert" className="text-destructive text-xs">
          {error}
        </p>
      )}
    </div>
  );
}
