/**
 * Google Drive URL parse + validate ONLY (docs/BLUEPRINT.md §2.4, §3).
 * No Drive API client, no scope, no credential — this only checks shape
 * and extracts a file ID for de-duplication. Mirrors the DB-side check
 * in the asset_publish_trigger migration (app.is_valid_drive_url).
 */

const DRIVE_HOST_PATTERN = /^https:\/\/(drive|docs)\.google\.com\//;

export function isValidDriveUrl(url: string): boolean {
  return DRIVE_HOST_PATTERN.test(url);
}

/** Extracts a file ID from common Drive URL shapes, for de-dup only. */
export function extractDriveFileId(url: string): string | null {
  const pathMatch = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
  if (pathMatch) return pathMatch[1];

  const queryMatch = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (queryMatch) return queryMatch[1];

  return null;
}
