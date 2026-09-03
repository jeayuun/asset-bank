"use client";

import { type FormEvent, useState, useTransition } from "react";

import { createCollection } from "@/app/(app)/collections/actions";
import { Button } from "@/components/ui/button";

export function CreateCollectionForm() {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [visibility, setVisibility] = useState<"personal" | "team">("personal");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      try {
        await createCollection({
          name,
          description: description || null,
          visibility,
        });
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to create collection",
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
          htmlFor="collection-name"
          className="text-muted-foreground text-xs font-medium"
        >
          Name
        </label>
        <input
          id="collection-name"
          type="text"
          required
          value={name}
          onChange={(event) => setName(event.target.value)}
          className="border-input bg-background h-9 w-56 rounded-md border px-3 text-sm"
          placeholder="KS1 Timers"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label
          htmlFor="collection-description"
          className="text-muted-foreground text-xs font-medium"
        >
          Description
        </label>
        <input
          id="collection-description"
          type="text"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          className="border-input bg-background h-9 w-64 rounded-md border px-3 text-sm"
          placeholder="Optional"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label
          htmlFor="collection-visibility"
          className="text-muted-foreground text-xs font-medium"
        >
          Visibility
        </label>
        <select
          id="collection-visibility"
          value={visibility}
          onChange={(event) =>
            setVisibility(event.target.value as "personal" | "team")
          }
          className="border-input bg-background h-9 rounded-md border px-2 text-sm"
        >
          <option value="personal">Personal</option>
          <option value="team">Team-shared</option>
        </select>
      </div>
      <Button type="submit" disabled={isPending}>
        {isPending ? "Creating…" : "Create collection"}
      </Button>
      {error && (
        <p role="alert" className="text-destructive w-full text-xs">
          {error}
        </p>
      )}
    </form>
  );
}
