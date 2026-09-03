import type { Metadata } from "next";

import { AssetCard, type CatalogAsset } from "@/components/catalog/asset-card";
import { getCurrentProfile } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Favorites — Asset Bank",
};

export default async function FavoritesPage() {
  const supabase = await createClient();
  const profile = await getCurrentProfile();

  // (app)/layout.tsx already redirects a signed-out visitor to /login;
  // profile is non-null in practice here.
  const { data: favorites } = profile
    ? await supabase
        .from("favorites")
        .select(
          "created_at, assets!inner(id, title, preview_thumb_path, asset_types(name))",
        )
        .eq("profile_id", profile.id)
        .order("created_at", { ascending: false })
    : { data: [] };

  const rows = favorites ?? [];
  const thumbPaths = rows.flatMap((row) =>
    row.assets.preview_thumb_path ? [row.assets.preview_thumb_path] : [],
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

  const catalogAssets: CatalogAsset[] = rows.map((row) => ({
    id: row.assets.id,
    title: row.assets.title,
    assetTypeName: row.assets.asset_types?.name ?? null,
    thumbUrl: row.assets.preview_thumb_path
      ? (signedUrlByPath.get(row.assets.preview_thumb_path) ?? null)
      : null,
    isFavorited: true,
  }));

  return (
    <main className="mx-auto max-w-5xl space-y-6 px-6 py-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Favorites</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          {catalogAssets.length} favorited asset
          {catalogAssets.length === 1 ? "" : "s"}
        </p>
      </div>

      {catalogAssets.length === 0 ? (
        <p className="text-muted-foreground py-12 text-center text-sm">
          No favorites yet. Tap the heart on any asset to save it here.
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
          {catalogAssets.map((asset) => (
            <AssetCard key={asset.id} asset={asset} view="grid" />
          ))}
        </div>
      )}
    </main>
  );
}
