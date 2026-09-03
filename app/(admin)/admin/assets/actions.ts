"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireRole } from "@/lib/auth/guards";
import { extractDriveFileId } from "@/lib/drive";
import { createClient } from "@/lib/supabase/server";
import {
  assetIdSchema,
  assignAssetLessonsSchema,
  createAssetSchema,
  recordPreviewUploadSchema,
  setAssetPoseActionSchema,
  updateAssetSchema,
} from "@/lib/validation/assets";
import type { Database } from "@/types/database.types";

type AssetUpdate = Database["public"]["Tables"]["assets"]["Update"];

export async function createAsset(input: unknown) {
  const { userId } = await requireRole("admin");
  const parsed = createAssetSchema.parse(input);

  const supabase = await createClient();
  const { data: asset, error } = await supabase
    .from("assets")
    .insert({
      title: parsed.title,
      description: parsed.description ?? null,
      asset_type_id: parsed.assetTypeId,
      drive_png_url: parsed.drivePngUrl ?? null,
      drive_eps_url: parsed.driveEpsUrl ?? null,
      drive_mp4_url: parsed.driveMp4Url ?? null,
      drive_png_file_id: parsed.drivePngUrl
        ? extractDriveFileId(parsed.drivePngUrl)
        : null,
      drive_eps_file_id: parsed.driveEpsUrl
        ? extractDriveFileId(parsed.driveEpsUrl)
        : null,
      drive_mp4_file_id: parsed.driveMp4Url
        ? extractDriveFileId(parsed.driveMp4Url)
        : null,
      primary_media: parsed.primaryMedia,
      character_profile_id: parsed.characterProfileId ?? null,
      created_by: userId,
      updated_by: userId,
    })
    .select("id")
    .single();

  if (error || !asset) {
    throw new Error(error?.message ?? "Failed to create asset");
  }

  if (parsed.keyStageIds.length > 0) {
    const { error: keyStageError } = await supabase
      .from("asset_key_stages")
      .insert(
        parsed.keyStageIds.map((key_stage_id) => ({
          asset_id: asset.id,
          key_stage_id,
        })),
      );

    if (keyStageError) {
      throw new Error(keyStageError.message);
    }
  }

  revalidatePath("/admin/assets");
  redirect(`/admin/assets/${asset.id}/edit`);
}

export async function updateAsset(input: unknown) {
  const { userId } = await requireRole("admin");
  const parsed = updateAssetSchema.parse(input);

  const supabase = await createClient();

  const patch: AssetUpdate = { updated_by: userId };
  if (parsed.title !== undefined) patch.title = parsed.title;
  if (parsed.description !== undefined) patch.description = parsed.description;
  if (parsed.primaryMedia !== undefined)
    patch.primary_media = parsed.primaryMedia;
  if (parsed.characterProfileId !== undefined)
    patch.character_profile_id = parsed.characterProfileId;
  if (parsed.drivePngUrl !== undefined) {
    patch.drive_png_url = parsed.drivePngUrl;
    patch.drive_png_file_id = parsed.drivePngUrl
      ? extractDriveFileId(parsed.drivePngUrl)
      : null;
  }
  if (parsed.driveEpsUrl !== undefined) {
    patch.drive_eps_url = parsed.driveEpsUrl;
    patch.drive_eps_file_id = parsed.driveEpsUrl
      ? extractDriveFileId(parsed.driveEpsUrl)
      : null;
  }
  if (parsed.driveMp4Url !== undefined) {
    patch.drive_mp4_url = parsed.driveMp4Url;
    patch.drive_mp4_file_id = parsed.driveMp4Url
      ? extractDriveFileId(parsed.driveMp4Url)
      : null;
  }

  const { error } = await supabase
    .from("assets")
    .update(patch)
    .eq("id", parsed.assetId);
  if (error) {
    throw new Error(error.message);
  }

  if (parsed.keyStageIds !== undefined) {
    const { error: deleteError } = await supabase
      .from("asset_key_stages")
      .delete()
      .eq("asset_id", parsed.assetId);
    if (deleteError) {
      throw new Error(deleteError.message);
    }

    if (parsed.keyStageIds.length > 0) {
      const { error: insertError } = await supabase
        .from("asset_key_stages")
        .insert(
          parsed.keyStageIds.map((key_stage_id) => ({
            asset_id: parsed.assetId,
            key_stage_id,
          })),
        );
      if (insertError) {
        throw new Error(insertError.message);
      }
    }
  }

  revalidatePath(`/admin/assets/${parsed.assetId}/edit`);
}

export async function requestPreviewUploadUrls(input: unknown) {
  await requireRole("admin");
  const { assetId } = assetIdSchema.parse(input);

  const supabase = await createClient();
  const rand = crypto.randomUUID();
  const displayPath = `assets/${assetId}/display-${rand}.webp`;
  const thumbPath = `assets/${assetId}/thumb-${rand}.webp`;

  const [displayResult, thumbResult] = await Promise.all([
    supabase.storage.from("asset-previews").createSignedUploadUrl(displayPath),
    supabase.storage.from("asset-previews").createSignedUploadUrl(thumbPath),
  ]);

  if (displayResult.error || !displayResult.data) {
    throw new Error(
      displayResult.error?.message ?? "Failed to create display upload URL",
    );
  }
  if (thumbResult.error || !thumbResult.data) {
    throw new Error(
      thumbResult.error?.message ?? "Failed to create thumb upload URL",
    );
  }

  return {
    display: { path: displayPath, token: displayResult.data.token },
    thumb: { path: thumbPath, token: thumbResult.data.token },
  };
}

export async function recordPreviewUpload(input: unknown) {
  await requireRole("admin");
  const parsed = recordPreviewUploadSchema.parse(input);

  const supabase = await createClient();
  const { error } = await supabase
    .from("assets")
    .update({
      preview_path: parsed.previewPath,
      preview_thumb_path: parsed.previewThumbPath,
      preview_width: parsed.previewWidth,
      preview_height: parsed.previewHeight,
      preview_bytes: parsed.previewBytes,
    })
    .eq("id", parsed.assetId);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath(`/admin/assets/${parsed.assetId}/edit`);
}

export async function publishAsset(input: unknown) {
  const { userId } = await requireRole("admin");
  const { assetId } = assetIdSchema.parse(input);

  const supabase = await createClient();
  const { error } = await supabase
    .from("assets")
    .update({
      status: "published",
      published_at: new Date().toISOString(),
      published_by: userId,
    })
    .eq("id", assetId);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath(`/admin/assets/${assetId}/edit`);
  revalidatePath("/admin/assets");
}

export async function unpublishAsset(input: unknown) {
  await requireRole("admin");
  const { assetId } = assetIdSchema.parse(input);

  const supabase = await createClient();
  const { error } = await supabase
    .from("assets")
    .update({ status: "draft" })
    .eq("id", assetId);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath(`/admin/assets/${assetId}/edit`);
  revalidatePath("/admin/assets");
}

export async function archiveAsset(input: unknown) {
  const { userId } = await requireRole("admin");
  const { assetId } = assetIdSchema.parse(input);

  const supabase = await createClient();
  const { error } = await supabase
    .from("assets")
    .update({
      status: "archived",
      archived_at: new Date().toISOString(),
      archived_by: userId,
    })
    .eq("id", assetId);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath(`/admin/assets/${assetId}/edit`);
  revalidatePath("/admin/assets");
}

export async function restoreAsset(input: unknown) {
  await requireRole("admin");
  const { assetId } = assetIdSchema.parse(input);

  const supabase = await createClient();
  const { error } = await supabase
    .from("assets")
    .update({ status: "draft", archived_at: null, archived_by: null })
    .eq("id", assetId);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath(`/admin/assets/${assetId}/edit`);
  revalidatePath("/admin/assets");
}

export async function setAssetPoseAction(input: unknown) {
  const { assetId, poseActionTermId } = setAssetPoseActionSchema.parse(input);
  await requireRole("admin");

  const supabase = await createClient();

  const { data: existing, error: fetchError } = await supabase
    .from("asset_taxonomy_terms")
    .select("taxonomy_term_id, taxonomy_terms(taxonomy_id, taxonomies(slug))")
    .eq("asset_id", assetId);
  if (fetchError) {
    throw new Error(fetchError.message);
  }

  const existingPoseTermIds = (existing ?? [])
    .filter((row) => row.taxonomy_terms?.taxonomies?.slug === "pose_action")
    .map((row) => row.taxonomy_term_id);

  if (existingPoseTermIds.length > 0) {
    const { error: deleteError } = await supabase
      .from("asset_taxonomy_terms")
      .delete()
      .eq("asset_id", assetId)
      .in("taxonomy_term_id", existingPoseTermIds);
    if (deleteError) {
      throw new Error(deleteError.message);
    }
  }

  if (poseActionTermId) {
    const { error: insertError } = await supabase
      .from("asset_taxonomy_terms")
      .insert({ asset_id: assetId, taxonomy_term_id: poseActionTermId });
    if (insertError) {
      throw new Error(insertError.message);
    }
  }

  revalidatePath(`/admin/assets/${assetId}/edit`);
}

export async function assignAssetLessons(input: unknown) {
  const { assetId, lessonIds } = assignAssetLessonsSchema.parse(input);
  const { userId } = await requireRole("admin");

  const supabase = await createClient();

  const { error: deleteLessonsError } = await supabase
    .from("asset_lessons")
    .delete()
    .eq("asset_id", assetId);
  if (deleteLessonsError) {
    throw new Error(deleteLessonsError.message);
  }

  const { error: deleteGradesError } = await supabase
    .from("asset_grades")
    .delete()
    .eq("asset_id", assetId);
  if (deleteGradesError) {
    throw new Error(deleteGradesError.message);
  }

  if (lessonIds.length > 0) {
    const { error: insertLessonsError } = await supabase
      .from("asset_lessons")
      .insert(
        lessonIds.map((lesson_id) => ({
          asset_id: assetId,
          lesson_id,
          added_by: userId,
        })),
      );
    if (insertLessonsError) {
      throw new Error(insertLessonsError.message);
    }

    const { data: lessons, error: lessonsError } = await supabase
      .from("lessons")
      .select("grade_id")
      .in("id", lessonIds);
    if (lessonsError) {
      throw new Error(lessonsError.message);
    }

    const gradeIds = [...new Set((lessons ?? []).map((l) => l.grade_id))];
    if (gradeIds.length > 0) {
      const { error: insertGradesError } = await supabase
        .from("asset_grades")
        .insert(gradeIds.map((grade_id) => ({ asset_id: assetId, grade_id })));
      if (insertGradesError) {
        throw new Error(insertGradesError.message);
      }
    }
  }

  revalidatePath(`/admin/assets/${assetId}/edit`);
}
