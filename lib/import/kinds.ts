export type ImportKind = "assets" | "characters" | "lessons";

export interface ImportColumn {
  /** Exact spreadsheet column header, also the raw row's object key. */
  header: string;
  required: boolean;
  description: string;
}

/**
 * The column definitions driving parsing, validation, and the
 * on-demand template download (docs/BLUEPRINT.md §10) — one source of
 * truth so the template can never drift from what the validator accepts.
 *
 * Deliberately trimmed for the assets kind (docs/PROGRESS.md's Phase 9
 * entry): title/description/asset type/Key Stages/Drive URLs/primary
 * media only — no taxonomy terms, lesson assignment, tags, or
 * character-profile linkage via spreadsheet. Those stay editable through
 * the single-asset edit form once the row lands as a draft.
 */
export const IMPORT_COLUMNS: Record<ImportKind, ImportColumn[]> = {
  assets: [
    {
      header: "title",
      required: true,
      description: 'Descriptive title, e.g. "Blue timer" (max 160 characters)',
    },
    {
      header: "description",
      required: false,
      description: "Optional longer description",
    },
    {
      header: "asset_type",
      required: true,
      description:
        "Asset type slug: characters | objects-and-backgrounds | math-tools | timers | template-tools",
    },
    {
      header: "key_stages",
      required: true,
      description: "Pipe-delimited Key Stage codes, e.g. KS1|KS2",
    },
    {
      header: "drive_png_url",
      required: false,
      description:
        "Google Drive link to the PNG (at least one Drive link is required)",
    },
    {
      header: "drive_eps_url",
      required: false,
      description: "Google Drive link to the EPS",
    },
    {
      header: "drive_mp4_url",
      required: false,
      description: "Google Drive link to the MP4",
    },
    {
      header: "primary_media",
      required: false,
      description: "image | video — defaults to image",
    },
  ],
  characters: [
    {
      header: "name",
      required: true,
      description:
        'Character name, e.g. "Mia" — a label, not an identity; duplicates in the same grade are allowed',
    },
    {
      header: "grade",
      required: true,
      description: "Grade number, 1-8",
    },
    {
      header: "profile_code",
      required: false,
      description: "Optional unique internal code",
    },
    {
      header: "character_type",
      required: false,
      description: "Character type term name — must already exist",
    },
    {
      header: "gender",
      required: false,
      description: "Female | Male",
    },
    {
      header: "character_group",
      required: false,
      description: "Character group term name — must already exist",
    },
    {
      header: "description",
      required: false,
      description: "Optional description",
    },
  ],
  lessons: [
    {
      header: "grade",
      required: true,
      description: "Grade number, 1-8",
    },
    {
      header: "term",
      required: true,
      description: "Term number, 1-3",
    },
    {
      header: "lesson_number",
      required: true,
      description: "Lesson number, 1-99, unique within grade + term",
    },
    {
      header: "title",
      required: true,
      description: "Lesson title",
    },
    {
      header: "description",
      required: false,
      description: "Optional description",
    },
  ],
};

export const IMPORT_KIND_LABELS: Record<ImportKind, string> = {
  assets: "Assets",
  characters: "Characters",
  lessons: "Lessons",
};

export const MAX_IMPORT_ROWS = 2000;
export const MAX_IMPORT_FILE_BYTES = 10 * 1024 * 1024;
