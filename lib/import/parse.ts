import "server-only";

import * as XLSX from "xlsx";

import { IMPORT_COLUMNS, type ImportKind } from "@/lib/import/kinds";

export interface ParsedRow {
  rowNumber: number;
  raw: Record<string, string>;
}

/**
 * Server-side SheetJS parsing (docs/BLUEPRINT.md §10 step 2). Accepts
 * .xlsx and .csv alike — XLSX.read() auto-detects both. The header row
 * is checked against the template signature: every required column for
 * this kind must be present, by exact name, in any order. Extra/unknown
 * columns are ignored rather than rejected, so a spreadsheet with a
 * stray helper column doesn't hard-fail the whole batch.
 */
export function parseImportFile(
  buffer: ArrayBuffer,
  kind: ImportKind,
): ParsedRow[] {
  const workbook = XLSX.read(buffer, { type: "array" });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    throw new Error("The file has no sheets");
  }
  const sheet = workbook.Sheets[sheetName];

  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: "",
    raw: false,
  });

  if (rows.length === 0) {
    throw new Error("The file has a header row but no data rows");
  }

  const headers = Object.keys(rows[0]);
  const requiredHeaders = IMPORT_COLUMNS[kind]
    .filter((c) => c.required)
    .map((c) => c.header);
  const missing = requiredHeaders.filter((h) => !headers.includes(h));
  if (missing.length > 0) {
    throw new Error(
      `Missing required column(s): ${missing.join(", ")}. Download the template for the exact header row.`,
    );
  }

  return rows.map((row, index) => ({
    rowNumber: index + 2, // header row is row 1, matching what a spreadsheet author sees
    raw: Object.fromEntries(
      Object.entries(row).map(([key, value]) => [key, String(value ?? "")]),
    ),
  }));
}
