import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { AddToCollection } from "@/components/catalog/add-to-collection";
import { FavoriteButton } from "@/components/catalog/favorite-button";
import { getCurrentProfile } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ assetId: string }>;
}): Promise<Metadata> {
  const { assetId } = await params;
  const supabase = await createClient();
  const { data: asset } = await supabase
    .from("assets")
    .select("title")
    .eq("id", assetId)
    .maybeSingle();
  return {
    title: asset ? `${asset.title} — Asset Bank` : "Asset — Asset Bank",
  };
}

export default async function AssetDetailPage({
  params,
}: {
  params: Promise<{ assetId: string }>;
}) {
  const { assetId } = await params;
  const supabase = await createClient();
  const viewerProfile = await getCurrentProfile();

  const { data: asset } = await supabase
    .from("assets")
    .select(
      "id, title, description, preview_path, primary_media, drive_png_url, drive_eps_url, drive_mp4_url, asset_types(name), character_profiles!assets_character_profile_id_fkey(id, name)",
    )
    .eq("id", assetId)
    .maybeSingle();

  if (!asset) {
    notFound();
  }

  const [
    { data: keyStageLinks },
    { data: taxonomyTermLinks },
    { data: tagLinks },
    { data: favorite },
    { data: ownedCollections },
    { data: memberCollections },
    { data: containingItems },
  ] = await Promise.all([
    supabase
      .from("asset_key_stages")
      .select("key_stages(code)")
      .eq("asset_id", assetId),
    supabase
      .from("asset_taxonomy_terms")
      .select("taxonomy_terms(name)")
      .eq("asset_id", assetId),
    supabase.from("asset_tags").select("tags(name)").eq("asset_id", assetId),
    viewerProfile
      ? supabase
          .from("favorites")
          .select("asset_id")
          .eq("profile_id", viewerProfile.id)
          .eq("asset_id", assetId)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    viewerProfile
      ? supabase
          .from("collections")
          .select("id, name")
          .eq("owner_id", viewerProfile.id)
      : Promise.resolve({ data: [] }),
    viewerProfile
      ? supabase
          .from("collection_members")
          .select("collections(id, name)")
          .eq("profile_id", viewerProfile.id)
          .eq("can_edit", true)
      : Promise.resolve({ data: [] }),
    supabase
      .from("collection_items")
      .select("collection_id")
      .eq("asset_id", assetId),
  ]);

  const editableCollectionsById = new Map<string, string>();
  for (const c of ownedCollections ?? [])
    editableCollectionsById.set(c.id, c.name);
  for (const m of memberCollections ?? []) {
    if (m.collections)
      editableCollectionsById.set(m.collections.id, m.collections.name);
  }
  const editableCollections = [...editableCollectionsById.entries()].map(
    ([id, name]) => ({ id, name }),
  );
  const containingIds = new Set(
    (containingItems ?? []).map((i) => i.collection_id),
  );
  const initialCollectionIds = editableCollections
    .map((c) => c.id)
    .filter((id) => containingIds.has(id));

  let previewUrl: string | null = null;
  if (asset.preview_path) {
    const { data: signed } = await supabase.storage
      .from("asset-previews")
      .createSignedUrl(asset.preview_path, 3600);
    previewUrl = signed?.signedUrl ?? null;
  }

  const driveLinks = [
    { label: "PNG", url: asset.drive_png_url },
    { label: "EPS", url: asset.drive_eps_url },
    { label: "MP4", url: asset.drive_mp4_url },
  ].filter((link): link is { label: string; url: string } => Boolean(link.url));

  return (
    <main className="mx-auto max-w-3xl space-y-6 px-6 py-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {asset.title}
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            {asset.asset_types?.name}
            {asset.character_profiles && (
              <>
                {" · "}
                <Link
                  href={`/characters/${asset.character_profiles.id}`}
                  className="underline"
                >
                  {asset.character_profiles.name}
                </Link>
              </>
            )}
          </p>
        </div>
        {viewerProfile && (
          <FavoriteButton
            assetId={asset.id}
            initialFavorited={Boolean(favorite)}
            size="lg"
          />
        )}
      </div>

      {viewerProfile && (
        <AddToCollection
          assetId={asset.id}
          editableCollections={editableCollections}
          initialCollectionIds={initialCollectionIds}
        />
      )}

      {previewUrl && (
        <div className="border-border bg-muted overflow-hidden rounded-lg border">
          {/* eslint-disable-next-line @next/next/no-img-element -- signed URL, not a static asset */}
          <img
            src={previewUrl}
            alt=""
            className="max-h-[480px] w-full object-contain"
          />
        </div>
      )}

      {asset.description && (
        <p className="text-muted-foreground text-sm">{asset.description}</p>
      )}

      <div className="flex flex-wrap gap-2">
        {driveLinks.map((link) => (
          <a
            key={link.label}
            href={link.url}
            target="_blank"
            rel="noopener noreferrer"
            className="border-input hover:bg-accent rounded-md border px-3 py-2 text-sm"
          >
            Open {link.label} in Google Drive
          </a>
        ))}
      </div>

      <div className="space-y-3 text-sm">
        {(keyStageLinks?.length ?? 0) > 0 && (
          <p>
            <span className="text-muted-foreground">Key Stages: </span>
            {keyStageLinks?.map((link) => link.key_stages?.code).join(", ")}
          </p>
        )}
        {(taxonomyTermLinks?.length ?? 0) > 0 && (
          <p>
            <span className="text-muted-foreground">Tags: </span>
            {taxonomyTermLinks
              ?.map((link) => link.taxonomy_terms?.name)
              .join(", ")}
          </p>
        )}
        {(tagLinks?.length ?? 0) > 0 && (
          <p>
            <span className="text-muted-foreground">Labels: </span>
            {tagLinks?.map((link) => link.tags?.name).join(", ")}
          </p>
        )}
      </div>
    </main>
  );
}
