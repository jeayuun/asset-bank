import Link from "next/link";

import { FavoriteButton } from "@/components/catalog/favorite-button";

export interface CatalogAsset {
  id: string;
  title: string;
  assetTypeName: string | null;
  thumbUrl: string | null;
  isFavorited: boolean;
}

export function AssetCard({
  asset,
  view,
}: {
  asset: CatalogAsset;
  view: "grid" | "list";
}) {
  if (view === "list") {
    return (
      <Link
        href={`/assets/${asset.id}`}
        className="border-border hover:bg-accent flex items-center gap-4 rounded-lg border p-3"
      >
        <div className="bg-muted h-16 w-16 shrink-0 overflow-hidden rounded-md">
          {asset.thumbUrl && (
            // eslint-disable-next-line @next/next/no-img-element -- signed URL, not a static asset
            <img
              src={asset.thumbUrl}
              alt=""
              className="h-full w-full object-cover"
            />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{asset.title}</p>
          <p className="text-muted-foreground text-xs">{asset.assetTypeName}</p>
        </div>
        <FavoriteButton
          assetId={asset.id}
          initialFavorited={asset.isFavorited}
        />
      </Link>
    );
  }

  return (
    <Link
      href={`/assets/${asset.id}`}
      className="border-border hover:bg-accent relative block rounded-lg border p-2"
    >
      <div className="bg-muted aspect-square overflow-hidden rounded-md">
        {asset.thumbUrl && (
          // eslint-disable-next-line @next/next/no-img-element -- signed URL, not a static asset
          <img
            src={asset.thumbUrl}
            alt=""
            className="h-full w-full object-cover"
          />
        )}
      </div>
      <div className="absolute top-3 right-3">
        <FavoriteButton
          assetId={asset.id}
          initialFavorited={asset.isFavorited}
        />
      </div>
      <p className="mt-2 truncate text-sm font-medium">{asset.title}</p>
      <p className="text-muted-foreground text-xs">{asset.assetTypeName}</p>
    </Link>
  );
}
