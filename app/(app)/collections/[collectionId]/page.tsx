import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { AssetCard, type CatalogAsset } from "@/components/catalog/asset-card";
import { DeleteCollectionButton } from "@/components/collections/delete-collection-button";
import { MemberManagement } from "@/components/collections/member-management";
import { RemoveItemButton } from "@/components/collections/remove-item-button";
import { getCurrentProfile } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ collectionId: string }>;
}): Promise<Metadata> {
  const { collectionId } = await params;
  const supabase = await createClient();
  const { data: collection } = await supabase
    .from("collections")
    .select("name")
    .eq("id", collectionId)
    .maybeSingle();
  return {
    title: collection
      ? `${collection.name} — Asset Bank`
      : "Collection — Asset Bank",
  };
}

export default async function CollectionDetailPage({
  params,
}: {
  params: Promise<{ collectionId: string }>;
}) {
  const { collectionId } = await params;
  const supabase = await createClient();
  const profile = await getCurrentProfile();

  const { data: collection } = await supabase
    .from("collections")
    .select("id, name, description, visibility, owner_id")
    .eq("id", collectionId)
    .maybeSingle();

  if (!collection) {
    notFound();
  }

  const isOwnerOrSuper =
    Boolean(profile) &&
    (collection.owner_id === profile?.id ||
      profile?.ctx.role === "super_admin");

  const [{ data: items }, { data: memberRows }, { data: myMembership }] =
    await Promise.all([
      supabase
        .from("collection_items")
        .select(
          "asset_id, position, assets!inner(id, title, preview_thumb_path, asset_types(name))",
        )
        .eq("collection_id", collectionId)
        .order("position"),
      collection.visibility === "team"
        ? supabase
            .from("collection_members")
            .select("profile_id, can_edit")
            .eq("collection_id", collectionId)
        : Promise.resolve({ data: [] }),
      profile
        ? supabase
            .from("collection_members")
            .select("can_edit")
            .eq("collection_id", collectionId)
            .eq("profile_id", profile.id)
            .maybeSingle()
        : Promise.resolve({ data: null }),
    ]);

  const canEdit = isOwnerOrSuper || Boolean(myMembership?.can_edit);

  const rows = items ?? [];
  const thumbPaths = rows.flatMap((row) =>
    row.assets.preview_thumb_path ? [row.assets.preview_thumb_path] : [],
  );

  let favoritedIds = new Set<string>();
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
  if (profile && rows.length > 0) {
    const { data: favorites } = await supabase
      .from("favorites")
      .select("asset_id")
      .eq("profile_id", profile.id)
      .in(
        "asset_id",
        rows.map((row) => row.asset_id),
      );
    favoritedIds = new Set((favorites ?? []).map((f) => f.asset_id));
  }

  const catalogAssets: CatalogAsset[] = rows.map((row) => ({
    id: row.assets.id,
    title: row.assets.title,
    assetTypeName: row.assets.asset_types?.name ?? null,
    thumbUrl: row.assets.preview_thumb_path
      ? (signedUrlByPath.get(row.assets.preview_thumb_path) ?? null)
      : null,
    isFavorited: favoritedIds.has(row.assets.id),
  }));

  let emailByProfileId = new Map<string, string>();
  if ((memberRows ?? []).length > 0) {
    const { data: memberEmails } = await supabase
      .schema("app")
      .rpc("collection_member_emails", { p_collection_id: collectionId });
    emailByProfileId = new Map(
      (memberEmails ?? []).map((row) => [row.profile_id, row.email]),
    );
  }

  const members = (memberRows ?? []).map((m) => ({
    profileId: m.profile_id,
    email: emailByProfileId.get(m.profile_id) ?? "unknown",
    canEdit: m.can_edit,
  }));

  return (
    <main className="mx-auto max-w-5xl space-y-6 px-6 py-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {collection.name}
          </h1>
          <p className="text-muted-foreground mt-1 text-sm capitalize">
            {collection.visibility} · {catalogAssets.length} asset
            {catalogAssets.length === 1 ? "" : "s"}
          </p>
          {collection.description && (
            <p className="text-muted-foreground mt-2 text-sm">
              {collection.description}
            </p>
          )}
        </div>
        {isOwnerOrSuper && (
          <DeleteCollectionButton collectionId={collection.id} />
        )}
      </div>

      {catalogAssets.length === 0 ? (
        <p className="text-muted-foreground py-12 text-center text-sm">
          No assets in this collection yet. Add one from any asset&apos;s page.
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
          {catalogAssets.map((asset) => (
            <div key={asset.id} className="relative">
              <AssetCard asset={asset} view="grid" />
              {canEdit && (
                <RemoveItemButton
                  collectionId={collection.id}
                  assetId={asset.id}
                />
              )}
            </div>
          ))}
        </div>
      )}

      {collection.visibility === "team" && isOwnerOrSuper && (
        <MemberManagement collectionId={collection.id} members={members} />
      )}
    </main>
  );
}
