import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { CommitButton } from "@/components/imports/commit-button";
import {
  ImportRowList,
  type ImportRowItem,
} from "@/components/imports/import-row-list";
import { IMPORT_KIND_LABELS } from "@/lib/import/kinds";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Import batch — Asset Bank",
};

function summarizeRow(kind: string, raw: Record<string, unknown>): string {
  if (kind === "assets") return String(raw.title ?? "");
  if (kind === "characters") {
    return `${raw.name ?? ""} (Grade ${raw.grade ?? "?"})`;
  }
  return `Grade ${raw.grade ?? "?"} / Term ${raw.term ?? "?"} / Lesson ${raw.lesson_number ?? "?"}: ${raw.title ?? ""}`;
}

export default async function ImportBatchPage({
  params,
}: {
  params: Promise<{ batchId: string }>;
}) {
  const { batchId } = await params;
  const supabase = await createClient();

  const { data: batch } = await supabase
    .from("import_batches")
    .select(
      "id, kind, filename, status, row_count, valid_count, error_count, committed_at, created_at",
    )
    .eq("id", batchId)
    .maybeSingle();

  if (!batch) {
    notFound();
  }

  const { data: rows } = await supabase
    .from("import_rows")
    .select("id, row_number, raw, status, errors")
    .eq("batch_id", batchId)
    .order("row_number");

  const rowItems: ImportRowItem[] = (rows ?? []).map((row) => ({
    id: row.id,
    rowNumber: row.row_number,
    status: row.status,
    errors: row.errors as ImportRowItem["errors"],
    summary: summarizeRow(batch.kind, row.raw as Record<string, unknown>),
  }));

  const includedCount = rowItems.filter((r) => r.status === "valid").length;
  const duplicateCount = rowItems.filter(
    (r) => r.status === "duplicate",
  ).length;
  const committedCount = rowItems.filter(
    (r) => r.status === "committed",
  ).length;

  const canCommit =
    batch.status === "validated" || batch.status === "committing";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">
          {batch.filename}
        </h1>
        <p className="text-muted-foreground text-sm">
          {IMPORT_KIND_LABELS[batch.kind]} · {batch.row_count} rows ·{" "}
          <span className="capitalize">{batch.status}</span>
        </p>
        <p className="text-muted-foreground mt-1 text-sm">
          {batch.valid_count} valid · {batch.error_count} invalid ·{" "}
          {duplicateCount} duplicate
          {batch.status === "committed" || batch.status === "failed"
            ? ` · ${committedCount} committed`
            : ""}
        </p>
      </div>

      {canCommit && (
        <CommitButton batchId={batch.id} includedCount={includedCount} />
      )}

      <ImportRowList batchId={batch.id} rows={rowItems} />
    </div>
  );
}
