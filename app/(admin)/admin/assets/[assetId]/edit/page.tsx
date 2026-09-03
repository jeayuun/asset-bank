import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { AssetStatusActions } from "@/components/assets/asset-status-actions";
import { CharacterAssignment } from "@/components/assets/character-assignment";
import { LessonAssignment } from "@/components/assets/lesson-assignment";
import { PreviewUploader } from "@/components/assets/preview-uploader";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Edit asset — Asset Bank",
};

export default async function EditAssetPage({
  params,
}: {
  params: Promise<{ assetId: string }>;
}) {
  const { assetId } = await params;
  const supabase = await createClient();

  const { data: asset } = await supabase
    .from("assets")
    .select(
      "id, title, description, status, primary_media, drive_png_url, drive_eps_url, drive_mp4_url, preview_path, preview_thumb_path, character_profile_id, asset_types(name, slug)",
    )
    .eq("id", assetId)
    .maybeSingle();

  if (!asset) {
    notFound();
  }

  const isCharacterType = asset.asset_types?.slug === "characters";

  const [
    { data: keyStageLinks },
    { data: poseActionLink },
    { data: characterProfiles },
    { data: poseActionTerms },
    { data: grades },
    { data: terms },
    { data: lessons },
    { data: assetLessonLinks },
  ] = await Promise.all([
    supabase
      .from("asset_key_stages")
      .select("key_stage_id")
      .eq("asset_id", assetId),
    isCharacterType
      ? supabase
          .from("asset_taxonomy_terms")
          .select(
            "taxonomy_term_id, taxonomy_terms!inner(taxonomies!inner(slug))",
          )
          .eq("asset_id", assetId)
          .eq("taxonomy_terms.taxonomies.slug", "pose_action")
          .maybeSingle()
      : Promise.resolve({ data: null }),
    isCharacterType
      ? supabase
          .from("character_profiles")
          .select("id, name, profile_code, grades(label)")
          .eq("is_active", true)
          .order("name")
      : Promise.resolve({ data: [] }),
    isCharacterType
      ? supabase
          .from("taxonomy_terms")
          .select("id, name, taxonomies!inner(slug)")
          .eq("taxonomies.slug", "pose_action")
          .eq("is_active", true)
          .order("name")
      : Promise.resolve({ data: [] }),
    supabase.from("grades").select("id, number, label").order("number"),
    supabase.from("terms").select("id, number, label").order("number"),
    supabase
      .from("lessons")
      .select("id, grade_id, term_id, code, title")
      .eq("is_active", true)
      .order("code"),
    supabase.from("asset_lessons").select("lesson_id").eq("asset_id", assetId),
  ]);

  let previewUrl: string | null = null;
  if (asset.preview_path) {
    const { data: signed } = await supabase.storage
      .from("asset-previews")
      .createSignedUrl(asset.preview_path, 3600);
    previewUrl = signed?.signedUrl ?? null;
  }

  return (
    <div className="max-w-xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">{asset.title}</h1>
        <p className="text-muted-foreground text-sm">
          {asset.asset_types?.name} ·{" "}
          <span className="capitalize">{asset.status}</span> ·{" "}
          {keyStageLinks?.length ?? 0} Key Stage
          {keyStageLinks?.length === 1 ? "" : "s"}
        </p>
      </div>

      <AssetStatusActions assetId={asset.id} status={asset.status} />

      <div className="space-y-2">
        <h2 className="text-sm font-semibold">Preview image</h2>
        {previewUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- signed URL, not a static asset
          <img
            src={previewUrl}
            alt=""
            className="border-border h-48 w-48 rounded-md border object-cover"
          />
        ) : (
          <p className="text-muted-foreground text-sm">
            No preview uploaded yet.
          </p>
        )}
        <PreviewUploader assetId={asset.id} />
      </div>

      <div className="space-y-1 text-sm">
        <h2 className="text-sm font-semibold">Drive links</h2>
        <p className="text-muted-foreground">
          PNG: {asset.drive_png_url ?? "—"}
        </p>
        <p className="text-muted-foreground">
          EPS: {asset.drive_eps_url ?? "—"}
        </p>
        <p className="text-muted-foreground">
          MP4: {asset.drive_mp4_url ?? "—"}
        </p>
      </div>

      {isCharacterType && (
        <CharacterAssignment
          assetId={asset.id}
          currentCharacterProfileId={asset.character_profile_id}
          currentPoseActionTermId={poseActionLink?.taxonomy_term_id ?? null}
          characterProfiles={(characterProfiles ?? []).map((profile) => ({
            id: profile.id,
            label:
              (profile.grades
                ? `${profile.name} (${profile.grades.label})`
                : profile.name) +
              (profile.profile_code ? ` — ${profile.profile_code}` : ""),
          }))}
          poseActionTerms={(poseActionTerms ?? []).map((term) => ({
            id: term.id,
            label: term.name,
          }))}
        />
      )}

      <LessonAssignment
        assetId={asset.id}
        grades={grades ?? []}
        terms={terms ?? []}
        lessons={(lessons ?? []).map((lesson) => ({
          id: lesson.id,
          gradeId: lesson.grade_id,
          termId: lesson.term_id,
          code: lesson.code,
          title: lesson.title,
        }))}
        initialLessonIds={(assetLessonLinks ?? []).map(
          (link) => link.lesson_id,
        )}
      />
    </div>
  );
}
