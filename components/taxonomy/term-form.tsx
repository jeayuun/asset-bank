"use client";

import { type FormEvent, useState, useTransition } from "react";

import { createTaxonomyTerm } from "@/app/(super)/super/taxonomy/actions";
import { Button } from "@/components/ui/button";

interface TermFormProps {
  taxonomyId: string;
  isClosed: boolean;
  parentOptions?: { id: string; name: string }[];
}

export function TermForm({
  taxonomyId,
  isClosed,
  parentOptions,
}: TermFormProps) {
  const [name, setName] = useState("");
  const [parentId, setParentId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  if (isClosed) {
    return (
      <p className="text-muted-foreground text-xs">
        This taxonomy is closed to new terms.
      </p>
    );
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      try {
        await createTaxonomyTerm({
          taxonomyId,
          name,
          parentId: parentId || null,
        });
        setName("");
        setParentId("");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to create term");
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
          htmlFor="term-name"
          className="text-muted-foreground text-xs font-medium"
        >
          Term name
        </label>
        <input
          id="term-name"
          type="text"
          required
          value={name}
          onChange={(event) => setName(event.target.value)}
          className="border-input bg-background h-9 w-64 rounded-md border px-3 text-sm"
        />
      </div>
      {parentOptions && (
        <div className="flex flex-col gap-1">
          <label
            htmlFor="term-parent"
            className="text-muted-foreground text-xs font-medium"
          >
            Group (optional)
          </label>
          <select
            id="term-parent"
            value={parentId}
            onChange={(event) => setParentId(event.target.value)}
            className="border-input bg-background h-9 rounded-md border px-2 text-sm"
          >
            <option value="">— top level —</option>
            {parentOptions.map((option) => (
              <option key={option.id} value={option.id}>
                {option.name}
              </option>
            ))}
          </select>
        </div>
      )}
      <Button type="submit" disabled={isPending}>
        {isPending ? "Adding…" : "Add term"}
      </Button>
      {error && (
        <p role="alert" className="text-destructive w-full text-xs">
          {error}
        </p>
      )}
    </form>
  );
}
