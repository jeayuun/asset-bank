import { z } from "zod";

import { isValidDriveUrl } from "@/lib/drive";

const driveUrlSchema = z.string().trim().url().refine(isValidDriveUrl, {
  message: "Must be a drive.google.com or docs.google.com link",
});

export const createAssetSchema = z
  .object({
    title: z.string().trim().min(1).max(160),
    description: z.string().trim().max(2000).nullable().optional(),
    assetTypeId: z.string().uuid(),
    drivePngUrl: driveUrlSchema.nullable().optional(),
    driveEpsUrl: driveUrlSchema.nullable().optional(),
    driveMp4Url: driveUrlSchema.nullable().optional(),
    primaryMedia: z.enum(["image", "video"]).default("image"),
    keyStageIds: z.array(z.string().uuid()).default([]),
    characterProfileId: z.string().uuid().nullable().optional(),
  })
  .refine((data) => data.drivePngUrl || data.driveEpsUrl || data.driveMp4Url, {
    message: "At least one Drive link is required",
    path: ["drivePngUrl"],
  });

export type CreateAssetInput = z.infer<typeof createAssetSchema>;

export const assetIdSchema = z.object({
  assetId: z.string().uuid(),
});

export const updateAssetSchema = z.object({
  assetId: z.string().uuid(),
  title: z.string().trim().min(1).max(160).optional(),
  description: z.string().trim().max(2000).nullable().optional(),
  drivePngUrl: driveUrlSchema.nullable().optional(),
  driveEpsUrl: driveUrlSchema.nullable().optional(),
  driveMp4Url: driveUrlSchema.nullable().optional(),
  primaryMedia: z.enum(["image", "video"]).optional(),
  keyStageIds: z.array(z.string().uuid()).optional(),
  characterProfileId: z.string().uuid().nullable().optional(),
});

export const recordPreviewUploadSchema = z.object({
  assetId: z.string().uuid(),
  previewPath: z.string().min(1),
  previewThumbPath: z.string().min(1),
  previewWidth: z.number().int().positive(),
  previewHeight: z.number().int().positive(),
  previewBytes: z.number().int().positive(),
});

// A pose is an asset-level fact (docs/BLUEPRINT.md §6.2: poses are
// individual asset entries grouped under a character profile), stored in
// asset_taxonomy_terms rather than a column — not a patch to `assets`.
export const setAssetPoseActionSchema = z.object({
  assetId: z.string().uuid(),
  poseActionTermId: z.string().uuid().nullable(),
});

// The grade → term → lesson picker (docs/PRODUCT_SPEC.md §7) assigns one
// asset to any number of lessons; asset_grades is kept in sync with the
// distinct grades those lessons belong to, not chosen directly.
export const assignAssetLessonsSchema = z.object({
  assetId: z.string().uuid(),
  lessonIds: z.array(z.string().uuid()),
});
