import "server-only";

/**
 * Trim, collapse whitespace, split pipe-delimited lists, coerce numbers
 * (docs/BLUEPRINT.md §10 step 3). Purely structural — no DB lookups, no
 * referential checks. Those happen in validate.ts, which has the
 * reference-data maps.
 */

function cleanString(value: string | undefined): string {
  return (value ?? "").trim().replace(/\s+/g, " ");
}

function splitPipeList(value: string | undefined): string[] {
  return (value ?? "")
    .split("|")
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
}

function toIntOrNull(value: string | undefined): number | null {
  const trimmed = (value ?? "").trim();
  if (trimmed === "") return null;
  const parsed = Number(trimmed);
  return Number.isInteger(parsed) ? parsed : null;
}

export interface NormalizedAssetsRow {
  title: string;
  description: string | null;
  assetTypeSlug: string;
  keyStageCodes: string[];
  drivePngUrl: string | null;
  driveEpsUrl: string | null;
  driveMp4Url: string | null;
  primaryMedia: string;
}

export function normalizeAssetsRow(
  raw: Record<string, string>,
): NormalizedAssetsRow {
  return {
    title: cleanString(raw.title),
    description: cleanString(raw.description) || null,
    assetTypeSlug: cleanString(raw.asset_type).toLowerCase(),
    keyStageCodes: splitPipeList(raw.key_stages).map((code) =>
      code.toUpperCase(),
    ),
    drivePngUrl: cleanString(raw.drive_png_url) || null,
    driveEpsUrl: cleanString(raw.drive_eps_url) || null,
    driveMp4Url: cleanString(raw.drive_mp4_url) || null,
    primaryMedia: (cleanString(raw.primary_media) || "image").toLowerCase(),
  };
}

export interface NormalizedCharactersRow {
  name: string;
  grade: number | null;
  profileCode: string | null;
  characterType: string | null;
  gender: string | null;
  characterGroup: string | null;
  description: string | null;
}

export function normalizeCharactersRow(
  raw: Record<string, string>,
): NormalizedCharactersRow {
  return {
    name: cleanString(raw.name),
    grade: toIntOrNull(raw.grade),
    profileCode: cleanString(raw.profile_code) || null,
    characterType: cleanString(raw.character_type) || null,
    gender: cleanString(raw.gender) || null,
    characterGroup: cleanString(raw.character_group) || null,
    description: cleanString(raw.description) || null,
  };
}

export interface NormalizedLessonsRow {
  grade: number | null;
  term: number | null;
  lessonNumber: number | null;
  title: string;
  description: string | null;
}

export function normalizeLessonsRow(
  raw: Record<string, string>,
): NormalizedLessonsRow {
  return {
    grade: toIntOrNull(raw.grade),
    term: toIntOrNull(raw.term),
    lessonNumber: toIntOrNull(raw.lesson_number),
    title: cleanString(raw.title),
    description: cleanString(raw.description) || null,
  };
}
