import { NextResponse } from "next/server";
import * as XLSX from "xlsx";

import { requireRole } from "@/lib/auth/guards";
import { IMPORT_COLUMNS, IMPORT_KIND_LABELS } from "@/lib/import/kinds";
import { createClient } from "@/lib/supabase/server";
import { importKindSchema } from "@/lib/validation/imports";

/**
 * Generates the template on demand from the same IMPORT_COLUMNS
 * definitions the parser and validator use, rather than serving a
 * stored file — the template can never drift out of sync with what's
 * actually accepted (docs/BLUEPRINT.md §10: "a downloadable XLSX
 * template carrying a locked header row, a validation sheet, and an
 * instructions tab").
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ kind: string }> },
) {
  await requireRole("admin");
  const { kind: kindParam } = await params;
  const parsedKind = importKindSchema.safeParse(kindParam);
  if (!parsedKind.success) {
    return NextResponse.json({ error: "Unknown import kind" }, { status: 400 });
  }
  const kind = parsedKind.data;
  const columns = IMPORT_COLUMNS[kind];

  const supabase = await createClient();
  const validValues = await loadValidValues(supabase, kind);

  const workbook = XLSX.utils.book_new();

  const templateSheet = XLSX.utils.aoa_to_sheet([columns.map((c) => c.header)]);
  templateSheet["!cols"] = columns.map(() => ({ wch: 24 }));
  XLSX.utils.book_append_sheet(workbook, templateSheet, "Template");

  const validValuesSheet = XLSX.utils.aoa_to_sheet([
    ["Column", "Valid values"],
    ...validValues.flatMap(({ column, values }) =>
      values.length > 0
        ? [[column, values.join(", ")]]
        : [[column, "(any text)"]],
    ),
  ]);
  validValuesSheet["!cols"] = [{ wch: 20 }, { wch: 70 }];
  XLSX.utils.book_append_sheet(workbook, validValuesSheet, "Valid values");

  const instructionsSheet = XLSX.utils.aoa_to_sheet([
    [`${IMPORT_KIND_LABELS[kind]} import — instructions`],
    [""],
    ["Column", "Required", "Description"],
    ...columns.map((c) => [c.header, c.required ? "Yes" : "No", c.description]),
    [""],
    ["Imports never publish — every row lands as a draft."],
    [
      "Imports never create taxonomy terms — add missing terms under Super Admin → Taxonomy first.",
    ],
    ["Imports never touch Google Drive — Drive links are stored as text only."],
  ]);
  instructionsSheet["!cols"] = [{ wch: 20 }, { wch: 10 }, { wch: 70 }];
  XLSX.utils.book_append_sheet(workbook, instructionsSheet, "Instructions");

  const buffer = XLSX.write(workbook, {
    type: "buffer",
    bookType: "xlsx",
  }) as Buffer;

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="asset-bank-${kind}-template.xlsx"`,
    },
  });
}

async function loadValidValues(
  supabase: Awaited<ReturnType<typeof createClient>>,
  kind: "assets" | "characters" | "lessons",
): Promise<{ column: string; values: string[] }[]> {
  if (kind === "assets") {
    const [{ data: assetTypes }, { data: keyStages }] = await Promise.all([
      supabase
        .from("asset_types")
        .select("slug")
        .eq("is_active", true)
        .order("sort_order"),
      supabase.from("key_stages").select("code").order("sort_order"),
    ]);
    return [
      { column: "asset_type", values: (assetTypes ?? []).map((t) => t.slug) },
      { column: "key_stages", values: (keyStages ?? []).map((k) => k.code) },
      { column: "primary_media", values: ["image", "video"] },
    ];
  }

  if (kind === "characters") {
    const { data: terms } = await supabase
      .from("taxonomy_terms")
      .select("name, taxonomies!inner(slug)")
      .in("taxonomies.slug", ["character_type", "character_group"])
      .eq("is_active", true)
      .order("name");
    return [
      { column: "grade", values: ["1", "2", "3", "4", "5", "6", "7", "8"] },
      { column: "gender", values: ["Female", "Male"] },
      {
        column: "character_type",
        values: (terms ?? [])
          .filter((t) => t.taxonomies?.slug === "character_type")
          .map((t) => t.name),
      },
      {
        column: "character_group",
        values: (terms ?? [])
          .filter((t) => t.taxonomies?.slug === "character_group")
          .map((t) => t.name),
      },
    ];
  }

  return [
    { column: "grade", values: ["1", "2", "3", "4", "5", "6", "7", "8"] },
    { column: "term", values: ["1", "2", "3"] },
    { column: "lesson_number", values: [] },
  ];
}
