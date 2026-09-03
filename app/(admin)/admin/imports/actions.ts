"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireRole } from "@/lib/auth/guards";
import {
  MAX_IMPORT_FILE_BYTES,
  MAX_IMPORT_ROWS,
  type ImportKind,
} from "@/lib/import/kinds";
import { parseImportFile } from "@/lib/import/parse";
import { validateImportRows } from "@/lib/import/validate";
import { createClient } from "@/lib/supabase/server";
import {
  commitImportBatchSchema,
  importKindSchema,
  setImportRowSkippedSchema,
} from "@/lib/validation/imports";
import type { Json } from "@/types/database.types";

const COMMIT_CHUNK_SIZE = 100;
const INSERT_CHUNK_SIZE = 500;

export async function uploadImportBatch(
  kindInput: unknown,
  formData: FormData,
) {
  const { userId } = await requireRole("admin");
  const kind = importKindSchema.parse(kindInput) as ImportKind;

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    throw new Error("Choose a file to upload");
  }
  if (file.size > MAX_IMPORT_FILE_BYTES) {
    throw new Error(
      `File must be ${MAX_IMPORT_FILE_BYTES / (1024 * 1024)}MB or smaller`,
    );
  }

  const buffer = await file.arrayBuffer();
  const parsedRows = parseImportFile(buffer, kind);
  if (parsedRows.length > MAX_IMPORT_ROWS) {
    throw new Error(
      `File has ${parsedRows.length} rows; the limit is ${MAX_IMPORT_ROWS}`,
    );
  }

  const supabase = await createClient();
  const validation = await validateImportRows(supabase, kind, parsedRows);

  const { data: batch, error: batchError } = await supabase
    .from("import_batches")
    .insert({
      kind,
      filename: file.name,
      uploaded_by: userId,
      status: "validated",
      row_count: parsedRows.length,
      valid_count: validation.validCount,
      error_count: validation.invalidCount,
    })
    .select("id")
    .single();

  if (batchError || !batch) {
    throw new Error(batchError?.message ?? "Failed to create import batch");
  }

  const rowsToInsert = validation.rows.map((row) => ({
    batch_id: batch.id,
    row_number: row.rowNumber,
    raw: row.raw,
    normalized: row.normalized as unknown as Json,
    status: row.status,
    errors: row.errors.length > 0 ? (row.errors as unknown as Json) : null,
  }));

  for (let i = 0; i < rowsToInsert.length; i += INSERT_CHUNK_SIZE) {
    const chunk = rowsToInsert.slice(i, i + INSERT_CHUNK_SIZE);
    const { error } = await supabase.from("import_rows").insert(chunk);
    if (error) throw new Error(error.message);
  }

  revalidatePath("/admin/imports");
  redirect(`/admin/imports/${batch.id}`);
}

export async function commitImportBatch(input: unknown) {
  const { batchId } = commitImportBatchSchema.parse(input);
  await requireRole("admin");

  const supabase = await createClient();
  const { data: validRows, error } = await supabase
    .from("import_rows")
    .select("id")
    .eq("batch_id", batchId)
    .eq("status", "valid");
  if (error) throw new Error(error.message);

  const ids = (validRows ?? []).map((row) => row.id);

  for (let i = 0; i < ids.length; i += COMMIT_CHUNK_SIZE) {
    const chunk = ids.slice(i, i + COMMIT_CHUNK_SIZE);
    const { error: commitError } = await supabase
      .schema("app")
      .rpc("commit_import_rows", { p_batch_id: batchId, p_row_ids: chunk });
    if (commitError) throw new Error(commitError.message);
  }

  const { error: finishError } = await supabase
    .schema("app")
    .rpc("finish_import_batch", { p_batch_id: batchId });
  if (finishError) throw new Error(finishError.message);

  revalidatePath(`/admin/imports/${batchId}`);
  revalidatePath("/admin/imports");
}

export async function setImportRowSkipped(input: unknown) {
  const { batchId, rowId, skipped } = setImportRowSkippedSchema.parse(input);
  await requireRole("admin");

  const supabase = await createClient();
  const { error } = await supabase
    .from("import_rows")
    .update({ status: skipped ? "skipped" : "valid" })
    .eq("id", rowId);
  if (error) throw new Error(error.message);

  revalidatePath(`/admin/imports/${batchId}`);
}
