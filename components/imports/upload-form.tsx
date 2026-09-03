"use client";

import { type FormEvent, useRef, useState, useTransition } from "react";

import { uploadImportBatch } from "@/app/(admin)/admin/imports/actions";
import { Button } from "@/components/ui/button";
import type { ImportKind } from "@/lib/import/kinds";

export function UploadForm({ kind }: { kind: ImportKind }) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const file = fileInputRef.current?.files?.[0];
    if (!file) {
      setError("Choose a file first");
      return;
    }
    const formData = new FormData();
    formData.set("file", file);
    startTransition(async () => {
      try {
        await uploadImportBatch(kind, formData);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Upload failed");
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
          htmlFor={`file-${kind}`}
          className="text-muted-foreground text-xs font-medium"
        >
          File (.xlsx or .csv)
        </label>
        <input
          id={`file-${kind}`}
          ref={fileInputRef}
          type="file"
          accept=".xlsx,.csv"
          className="text-sm"
        />
      </div>
      <Button type="submit" disabled={isPending}>
        {isPending ? "Uploading…" : "Upload and validate"}
      </Button>
      {error && (
        <p role="alert" className="text-destructive w-full text-xs">
          {error}
        </p>
      )}
    </form>
  );
}
