"use client";

import { type FormEvent, useState, useTransition } from "react";

import { createRequest } from "@/app/(app)/requests/actions";
import { Button } from "@/components/ui/button";

interface Option {
  id: string;
  label: string;
}

export function CreateRequestForm({
  assetTypes,
  keyStages,
  grades,
  lessons,
}: {
  assetTypes: Option[];
  keyStages: Option[];
  grades: Option[];
  lessons: Option[];
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [assetTypeId, setAssetTypeId] = useState("");
  const [keyStageId, setKeyStageId] = useState("");
  const [gradeId, setGradeId] = useState("");
  const [lessonId, setLessonId] = useState("");
  const [priority, setPriority] = useState<
    "low" | "normal" | "high" | "urgent"
  >("normal");
  const [neededBy, setNeededBy] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      try {
        await createRequest({
          title,
          description: description || null,
          assetTypeId: assetTypeId || null,
          keyStageId: keyStageId || null,
          gradeId: gradeId || null,
          lessonId: lessonId || null,
          priority,
          neededBy: neededBy || null,
        });
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to submit request",
        );
      }
    });
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="border-border max-w-xl space-y-4 rounded-lg border p-6"
    >
      <div className="flex flex-col gap-1">
        <label
          htmlFor="request-title"
          className="text-muted-foreground text-xs font-medium"
        >
          Title
        </label>
        <input
          id="request-title"
          type="text"
          required
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          className="border-input bg-background h-9 rounded-md border px-3 text-sm"
          placeholder="A blank calendar grid for Term 2"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label
          htmlFor="request-description"
          className="text-muted-foreground text-xs font-medium"
        >
          Description
        </label>
        <textarea
          id="request-description"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          rows={3}
          className="border-input bg-background rounded-md border px-3 py-2 text-sm"
          placeholder="What is it for, and any specific details"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1">
          <label
            htmlFor="request-asset-type"
            className="text-muted-foreground text-xs font-medium"
          >
            Asset type
          </label>
          <select
            id="request-asset-type"
            value={assetTypeId}
            onChange={(event) => setAssetTypeId(event.target.value)}
            className="border-input bg-background h-9 rounded-md border px-2 text-sm"
          >
            <option value="">—</option>
            {assetTypes.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label
            htmlFor="request-key-stage"
            className="text-muted-foreground text-xs font-medium"
          >
            Key Stage
          </label>
          <select
            id="request-key-stage"
            value={keyStageId}
            onChange={(event) => setKeyStageId(event.target.value)}
            className="border-input bg-background h-9 rounded-md border px-2 text-sm"
          >
            <option value="">—</option>
            {keyStages.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label
            htmlFor="request-grade"
            className="text-muted-foreground text-xs font-medium"
          >
            Grade
          </label>
          <select
            id="request-grade"
            value={gradeId}
            onChange={(event) => setGradeId(event.target.value)}
            className="border-input bg-background h-9 rounded-md border px-2 text-sm"
          >
            <option value="">—</option>
            {grades.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label
            htmlFor="request-lesson"
            className="text-muted-foreground text-xs font-medium"
          >
            Lesson
          </label>
          <select
            id="request-lesson"
            value={lessonId}
            onChange={(event) => setLessonId(event.target.value)}
            className="border-input bg-background h-9 rounded-md border px-2 text-sm"
          >
            <option value="">—</option>
            {lessons.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label
            htmlFor="request-priority"
            className="text-muted-foreground text-xs font-medium"
          >
            Priority
          </label>
          <select
            id="request-priority"
            value={priority}
            onChange={(event) =>
              setPriority(
                event.target.value as "low" | "normal" | "high" | "urgent",
              )
            }
            className="border-input bg-background h-9 rounded-md border px-2 text-sm"
          >
            <option value="low">Low</option>
            <option value="normal">Normal</option>
            <option value="high">High</option>
            <option value="urgent">Urgent</option>
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label
            htmlFor="request-needed-by"
            className="text-muted-foreground text-xs font-medium"
          >
            Needed by
          </label>
          <input
            id="request-needed-by"
            type="date"
            value={neededBy}
            onChange={(event) => setNeededBy(event.target.value)}
            className="border-input bg-background h-9 rounded-md border px-3 text-sm"
          />
        </div>
      </div>

      <Button type="submit" disabled={isPending}>
        {isPending ? "Submitting…" : "Submit request"}
      </Button>
      {error && (
        <p role="alert" className="text-destructive text-xs">
          {error}
        </p>
      )}
    </form>
  );
}
