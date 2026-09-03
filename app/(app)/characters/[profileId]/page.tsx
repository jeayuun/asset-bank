import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { AssetCard, type CatalogAsset } from "@/components/catalog/asset-card";
import { getCurrentProfile } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ profileId: string }>;
}): Promise<Metadata> {
  const { profileId } = await params;
  const supabase = await createClient();
  const { data: profile } = await supabase
    .from("character_profiles")
    .select("name")
    .eq("id", profileId)
    .maybeSingle();
  return {
    title: profile ? `${profile.name} — Asset Bank` : "Character — Asset Bank",
  };
}

export default async function CharacterProfilePage({
  params,
}: {
  params: Promise<{ profileId: string }>;
}) {
  const { profileId } = await params;
  const supabase = await createClient();
  const viewerProfile = await getCurrentProfile();

  const { data: profile } = await supabase
    .from("character_profiles")
    .select(
      "id, name, description, grades(label), key_stages(code), character_type:taxonomy_terms!character_profiles_character_type_term_id_fkey(name), gender:taxonomy_terms!character_profiles_gender_term_id_fkey(name), character_group:taxonomy_terms!character_profiles_character_group_term_id_fkey(name)",
    )
    .eq("id", profileId)
    .maybeSingle();

  if (!profile) {
    notFound();
  }

  // Poses are individual published asset entries grouped under this
  // profile (docs/BLUEPRINT.md §6.2). RLS already scopes a Viewer to
  // published rows — no status filter needed here.
  const { data: poses } = await supabase
    .from("assets")
    .select("id, title, preview_thumb_path, asset_types(name)")
    .eq("character_profile_id", profileId)
    .order("created_at", { ascending: false });

  const rows = poses ?? [];
  const thumbPaths = rows.flatMap((asset) =>
    asset.preview_thumb_path ? [asset.preview_thumb_path] : [],
  );

  let signedUrlByPath = new Map<string, string>();
  if (thumbPaths.length > 0) {
    const { data: signedUrls } = await supabase.storage
      .from("asset-previews")
      .createSignedUrls(thumbPaths, 3600);
    signedUrlByPath = new Map(
      (signedUrls ?? []).flatMap((entry) =>
        entry.signedUrl ? [[entry.path ?? "", entry.signedUrl] as const] : [],
      ),
    );
  }

  let favoritedIds = new Set<string>();
  if (viewerProfile && rows.length > 0) {
    const { data: favorites } = await supabase
      .from("favorites")
      .select("asset_id")
      .eq("profile_id", viewerProfile.id)
      .in(
        "asset_id",
        rows.map((asset) => asset.id),
      );
    favoritedIds = new Set((favorites ?? []).map((f) => f.asset_id));
  }

  const poseAssets: CatalogAsset[] = rows.map((asset) => ({
    id: asset.id,
    title: asset.title,
    assetTypeName: asset.asset_types?.name ?? null,
    thumbUrl: asset.preview_thumb_path
      ? (signedUrlByPath.get(asset.preview_thumb_path) ?? null)
      : null,
    isFavorited: favoritedIds.has(asset.id),
  }));

  return (
    <main className="mx-auto max-w-5xl space-y-6 px-6 py-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          {profile.name}
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          {profile.grades?.label}
          {profile.key_stages?.code ? ` · ${profile.key_stages.code}` : ""}
          {profile.character_type?.name
            ? ` · ${profile.character_type.name}`
            : ""}
          {profile.gender?.name ? ` · ${profile.gender.name}` : ""}
          {profile.character_group?.name
            ? ` · ${profile.character_group.name}`
            : ""}
        </p>
        {profile.description && (
          <p className="text-muted-foreground mt-2 text-sm">
            {profile.description}
          </p>
        )}
      </div>

      <div>
        <h2 className="text-sm font-semibold">
          {poseAssets.length} pose{poseAssets.length === 1 ? "" : "s"}
        </h2>
      </div>

      {poseAssets.length === 0 ? (
        <p className="text-muted-foreground py-12 text-center text-sm">
          No published poses yet for this character.
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
          {poseAssets.map((asset) => (
            <AssetCard key={asset.id} asset={asset} view="grid" />
          ))}
        </div>
      )}
    </main>
  );
}
