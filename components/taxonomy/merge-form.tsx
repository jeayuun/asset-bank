"use client";

import { type FormEvent, useState, useTransition } from "react";

import { mergeTaxonomyTerms } from "@/app/(super)/super/taxonomy/actions";
import { Button } from "@/components/ui/button";

export function MergeForm({
  terms,
}: {
  terms: { id: string; name: string }[];
}) {
  const [sourceId, setSourceId] = useState("");
  const [targetId, setTargetId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  if (terms.length < 2) return null;

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      try {
        await mergeTaxonomyTerms({ sourceId, targetId });
        setSourceId("");
        setTargetId("");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to merge terms");
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
          htmlFor="merge-source"
          className="text-muted-foreground text-xs font-medium"
        >
          Merge this term…
        </label>
        <select
          id="merge-source"
          required
          value={sourceId}
          onChange={(event) => setSourceId(event.target.value)}
          className="border-input bg-background h-9 w-52 rounded-md border px-2 text-sm"
        >
          <option value="">Select a term</option>
          {terms.map((term) => (
            <option key={term.id} value={term.id}>
              {term.name}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-col gap-1">
        <label
          htmlFor="merge-target"
          className="text-muted-foreground text-xs font-medium"
        >
          …into this term
        </label>
        <select
          id="merge-target"
          required
          value={targetId}
          onChange={(event) => setTargetId(event.target.value)}
          className="border-input bg-background h-9 w-52 rounded-md border px-2 text-sm"
        >
          <option value="">Select a term</option>
          {terms
            .filter((term) => term.id !== sourceId)
            .map((term) => (
              <option key={term.id} value={term.id}>
                {term.name}
              </option>
            ))}
        </select>
      </div>
      <Button type="submit" variant="outline" disabled={isPending}>
        {isPending ? "Merging…" : "Merge"}
      </Button>
      {error && (
        <p role="alert" className="text-destructive w-full text-xs">
          {error}
        </p>
      )}
    </form>
  );
}
