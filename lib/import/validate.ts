import "server-only";

import { extractDriveFileId, isValidDriveUrl } from "@/lib/drive";
import {
  normalizeAssetsRow,
  normalizeCharactersRow,
  normalizeLessonsRow,
} from "@/lib/import/normalize";
import type { ParsedRow } from "@/lib/import/parse";
import type { ImportKind } from "@/lib/import/kinds";
import type { createClient } from "@/lib/supabase/server";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

export interface RowError {
  column: string;
  message: string;
}

export type ValidatedRowStatus = "valid" | "invalid" | "duplicate";

export interface ValidatedRow {
  rowNumber: number;
  raw: Record<string, string>;
  normalized: Record<string, unknown> | null;
  status: ValidatedRowStatus;
  errors: RowError[];
}

export interface ValidationSummary {
  rows: ValidatedRow[];
  validCount: number;
  invalidCount: number;
  duplicateCount: number;
}

function summarize(rows: ValidatedRow[]): ValidationSummary {
  return {
    rows,
    validCount: rows.filter((r) => r.status === "valid").length,
    invalidCount: rows.filter((r) => r.status === "invalid").length,
    duplicateCount: rows.filter((r) => r.status === "duplicate").length,
  };
}

/**
 * The same referential + duplicate checks the Blueprint calls for
 * (§10 step 4), run once against reference data fetched up front rather
 * than per row. Structural checks (non-empty, max length, valid Drive
 * URL shape) happen inline per field — this app has no single-asset Zod
 * schema shaped like a spreadsheet row (UUIDs vs. slugs/codes/names), so
 * duplicating exact per-field rules here is more direct than bending an
 * existing schema to fit two different input shapes.
 */
export async function validateImportRows(
  supabase: SupabaseServerClient,
  kind: ImportKind,
  parsedRows: ParsedRow[],
): Promise<ValidationSummary> {
  if (kind === "assets") return validateAssetsRows(supabase, parsedRows);
  if (kind === "characters")
    return validateCharactersRows(supabase, parsedRows);
  return validateLessonsRows(supabase, parsedRows);
}

const VALID_PRIMARY_MEDIA = new Set(["image", "video"]);

async function validateAssetsRows(
  supabase: SupabaseServerClient,
  parsedRows: ParsedRow[],
): Promise<ValidationSummary> {
  const [{ data: assetTypes }, { data: keyStages }, { data: existingAssets }] =
    await Promise.all([
      supabase.from("asset_types").select("id, slug").eq("is_active", true),
      supabase.from("key_stages").select("id, code"),
      supabase
        .from("assets")
        .select("drive_png_file_id, drive_eps_file_id, drive_mp4_file_id"),
    ]);

  const assetTypeBySlug = new Map(
    (assetTypes ?? []).map((t) => [t.slug, t.id]),
  );
  const keyStageByCode = new Map((keyStages ?? []).map((k) => [k.code, k.id]));
  const existingFileIds = new Set(
    (existingAssets ?? []).flatMap((a) =>
      [a.drive_png_file_id, a.drive_eps_file_id, a.drive_mp4_file_id].filter(
        (id): id is string => Boolean(id),
      ),
    ),
  );

  const seenTitles = new Set<string>();
  const seenFileIdsInBatch = new Set<string>();

  const rows: ValidatedRow[] = parsedRows.map((parsed) => {
    const n = normalizeAssetsRow(parsed.raw);
    const errors: RowError[] = [];

    if (!n.title) {
      errors.push({ column: "title", message: "Title is required" });
    } else if (n.title.length > 160) {
      errors.push({
        column: "title",
        message: "Title must be 160 characters or fewer",
      });
    }

    const assetTypeId = assetTypeBySlug.get(n.assetTypeSlug);
    if (!n.assetTypeSlug) {
      errors.push({ column: "asset_type", message: "Asset type is required" });
    } else if (!assetTypeId) {
      errors.push({
        column: "asset_type",
        message: `"${n.assetTypeSlug}" is not a known asset type slug`,
      });
    }

    const keyStageIds: string[] = [];
    if (n.keyStageCodes.length === 0) {
      errors.push({
        column: "key_stages",
        message: "At least one Key Stage is required",
      });
    } else {
      for (const code of n.keyStageCodes) {
        const id = keyStageByCode.get(code);
        if (!id) {
          errors.push({
            column: "key_stages",
            message: `"${code}" is not a known Key Stage code`,
          });
        } else {
          keyStageIds.push(id);
        }
      }
    }

    const driveUrls = [n.drivePngUrl, n.driveEpsUrl, n.driveMp4Url].filter(
      (url): url is string => Boolean(url),
    );
    if (driveUrls.length === 0) {
      errors.push({
        column: "drive_png_url",
        message: "At least one Drive link is required",
      });
    }
    for (const [column, url] of [
      ["drive_png_url", n.drivePngUrl],
      ["drive_eps_url", n.driveEpsUrl],
      ["drive_mp4_url", n.driveMp4Url],
    ] as const) {
      if (url && !isValidDriveUrl(url)) {
        errors.push({
          column,
          message: "Must be a drive.google.com or docs.google.com link",
        });
      }
    }

    if (!VALID_PRIMARY_MEDIA.has(n.primaryMedia)) {
      errors.push({
        column: "primary_media",
        message: 'Must be "image" or "video"',
      });
    }
    if (n.primaryMedia === "video" && !n.driveMp4Url) {
      errors.push({
        column: "primary_media",
        message: "primary_media = video requires drive_mp4_url",
      });
    }

    // Cross-row + existing-record duplicate detection (§10 step 4).
    const fileIds = driveUrls
      .map(extractDriveFileId)
      .filter((id): id is string => Boolean(id));
    const isExistingDuplicate = fileIds.some((id) => existingFileIds.has(id));
    const isBatchDuplicateTitle =
      n.title !== "" && seenTitles.has(n.title.toLowerCase());
    const isBatchDuplicateFileId = fileIds.some((id) =>
      seenFileIdsInBatch.has(id),
    );

    if (n.title) seenTitles.add(n.title.toLowerCase());
    for (const id of fileIds) seenFileIdsInBatch.add(id);

    if (errors.length > 0) {
      return {
        rowNumber: parsed.rowNumber,
        raw: parsed.raw,
        normalized: null,
        status: "invalid",
        errors,
      };
    }

    if (
      isExistingDuplicate ||
      isBatchDuplicateFileId ||
      isBatchDuplicateTitle
    ) {
      return {
        rowNumber: parsed.rowNumber,
        raw: parsed.raw,
        normalized: null,
        status: "duplicate",
        errors: [
          {
            column:
              isBatchDuplicateTitle &&
              !isExistingDuplicate &&
              !isBatchDuplicateFileId
                ? "title"
                : "drive_png_url",
            message: isExistingDuplicate
              ? "An asset with this Drive file already exists"
              : isBatchDuplicateFileId
                ? "This Drive file appears more than once in this file"
                : "This title appears more than once in this file",
          },
        ],
      };
    }

    return {
      rowNumber: parsed.rowNumber,
      raw: parsed.raw,
      normalized: {
        title: n.title,
        description: n.description,
        assetTypeId,
        keyStageIds,
        drivePngUrl: n.drivePngUrl,
        driveEpsUrl: n.driveEpsUrl,
        driveMp4Url: n.driveMp4Url,
        drivePngFileId: n.drivePngUrl
          ? extractDriveFileId(n.drivePngUrl)
          : null,
        driveEpsFileId: n.driveEpsUrl
          ? extractDriveFileId(n.driveEpsUrl)
          : null,
        driveMp4FileId: n.driveMp4Url
          ? extractDriveFileId(n.driveMp4Url)
          : null,
        primaryMedia: n.primaryMedia,
      },
      status: "valid",
      errors: [],
    };
  });

  return summarize(rows);
}

const VALID_GENDERS = new Set(["Female", "Male"]);

async function validateCharactersRows(
  supabase: SupabaseServerClient,
  parsedRows: ParsedRow[],
): Promise<ValidationSummary> {
  const [{ data: grades }, { data: terms }] = await Promise.all([
    supabase.from("grades").select("id, number"),
    supabase
      .from("taxonomy_terms")
      .select("id, name, taxonomies!inner(slug)")
      .in("taxonomies.slug", ["character_type", "gender", "character_group"])
      .eq("is_active", true),
  ]);

  const gradeByNumber = new Map((grades ?? []).map((g) => [g.number, g.id]));
  const termsBySlug = (slug: string) =>
    new Map(
      (terms ?? [])
        .filter((t) => t.taxonomies?.slug === slug)
        .map((t) => [t.name.toLowerCase(), t.id]),
    );
  const characterTypeByName = termsBySlug("character_type");
  const genderByName = termsBySlug("gender");
  const characterGroupByName = termsBySlug("character_group");

  const seenNameGrade = new Map<string, number>();

  const rows: ValidatedRow[] = parsedRows.map((parsed) => {
    const n = normalizeCharactersRow(parsed.raw);
    const errors: RowError[] = [];

    if (!n.name) {
      errors.push({ column: "name", message: "Name is required" });
    }

    const gradeId = n.grade !== null ? gradeByNumber.get(n.grade) : undefined;
    if (n.grade === null) {
      errors.push({ column: "grade", message: "Grade is required" });
    } else if (!gradeId) {
      errors.push({ column: "grade", message: `Grade ${n.grade} is not 1-8` });
    }

    let characterTypeTermId: string | undefined;
    if (n.characterType) {
      characterTypeTermId = characterTypeByName.get(
        n.characterType.toLowerCase(),
      );
      if (!characterTypeTermId) {
        errors.push({
          column: "character_type",
          message: `"${n.characterType}" is not a known character type — create it under /super/taxonomy first`,
        });
      }
    }

    let genderTermId: string | undefined;
    if (n.gender) {
      if (!VALID_GENDERS.has(n.gender)) {
        errors.push({
          column: "gender",
          message: 'Must be "Female" or "Male"',
        });
      } else {
        genderTermId = genderByName.get(n.gender.toLowerCase());
      }
    }

    let characterGroupTermId: string | undefined;
    if (n.characterGroup) {
      characterGroupTermId = characterGroupByName.get(
        n.characterGroup.toLowerCase(),
      );
      if (!characterGroupTermId) {
        errors.push({
          column: "character_group",
          message: `"${n.characterGroup}" is not a known character group — create it under /super/taxonomy first`,
        });
      }
    }

    // Deliberately a warning-shaped duplicate note, not an error — the
    // Blueprint explicitly allows two same-named profiles in the same
    // grade (docs/DECISIONS.md D-06). Flagged, but never blocks import.
    let duplicateWarning: RowError | null = null;
    if (n.name && n.grade !== null) {
      const key = `${n.name.toLowerCase()}::${n.grade}`;
      const priorRow = seenNameGrade.get(key);
      if (priorRow !== undefined) {
        duplicateWarning = {
          column: "name",
          message: `Row ${priorRow} already uses this name in Grade ${n.grade} — allowed, just confirm it's not a mistake`,
        };
      }
      seenNameGrade.set(key, parsed.rowNumber);
    }

    if (errors.length > 0) {
      return {
        rowNumber: parsed.rowNumber,
        raw: parsed.raw,
        normalized: null,
        status: "invalid",
        errors,
      };
    }

    return {
      rowNumber: parsed.rowNumber,
      raw: parsed.raw,
      normalized: {
        name: n.name,
        profileCode: n.profileCode,
        gradeId,
        characterTypeTermId: characterTypeTermId ?? null,
        genderTermId: genderTermId ?? null,
        characterGroupTermId: characterGroupTermId ?? null,
        description: n.description,
      },
      status: "valid",
      errors: duplicateWarning ? [duplicateWarning] : [],
    };
  });

  return summarize(rows);
}

async function validateLessonsRows(
  supabase: SupabaseServerClient,
  parsedRows: ParsedRow[],
): Promise<ValidationSummary> {
  const [{ data: grades }, { data: terms }, { data: existingLessons }] =
    await Promise.all([
      supabase.from("grades").select("id, number"),
      supabase.from("terms").select("id, number"),
      supabase.from("lessons").select("grade_id, term_id, lesson_number"),
    ]);

  const gradeByNumber = new Map((grades ?? []).map((g) => [g.number, g.id]));
  const termByNumber = new Map((terms ?? []).map((t) => [t.number, t.id]));
  const existingKeys = new Set(
    (existingLessons ?? []).map(
      (l) => `${l.grade_id}::${l.term_id}::${l.lesson_number}`,
    ),
  );
  const seenInBatch = new Set<string>();

  const rows: ValidatedRow[] = parsedRows.map((parsed) => {
    const n = normalizeLessonsRow(parsed.raw);
    const errors: RowError[] = [];

    const gradeId = n.grade !== null ? gradeByNumber.get(n.grade) : undefined;
    if (n.grade === null) {
      errors.push({ column: "grade", message: "Grade is required" });
    } else if (!gradeId) {
      errors.push({ column: "grade", message: `Grade ${n.grade} is not 1-8` });
    }

    const termId = n.term !== null ? termByNumber.get(n.term) : undefined;
    if (n.term === null) {
      errors.push({ column: "term", message: "Term is required" });
    } else if (!termId) {
      errors.push({ column: "term", message: `Term ${n.term} is not 1-3` });
    }

    if (n.lessonNumber === null) {
      errors.push({
        column: "lesson_number",
        message: "Lesson number is required",
      });
    } else if (n.lessonNumber < 1 || n.lessonNumber > 99) {
      errors.push({
        column: "lesson_number",
        message: "Lesson number must be 1-99",
      });
    }

    if (!n.title) {
      errors.push({ column: "title", message: "Title is required" });
    } else if (n.title.length > 160) {
      errors.push({
        column: "title",
        message: "Title must be 160 characters or fewer",
      });
    }

    if (errors.length === 0 && gradeId && termId && n.lessonNumber !== null) {
      const key = `${gradeId}::${termId}::${n.lessonNumber}`;
      if (existingKeys.has(key) || seenInBatch.has(key)) {
        return {
          rowNumber: parsed.rowNumber,
          raw: parsed.raw,
          normalized: null,
          status: "duplicate",
          errors: [
            {
              column: "lesson_number",
              message: `Grade ${n.grade} / Term ${n.term} / Lesson ${n.lessonNumber} already exists`,
            },
          ],
        };
      }
      seenInBatch.add(key);
    }

    if (errors.length > 0) {
      return {
        rowNumber: parsed.rowNumber,
        raw: parsed.raw,
        normalized: null,
        status: "invalid",
        errors,
      };
    }

    return {
      rowNumber: parsed.rowNumber,
      raw: parsed.raw,
      normalized: {
        gradeId,
        termId,
        lessonNumber: n.lessonNumber,
        title: n.title,
        description: n.description,
      },
      status: "valid",
      errors: [],
    };
  });

  return summarize(rows);
}
