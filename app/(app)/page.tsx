import type { Metadata } from "next";
import Link from "next/link";

import { AssetCard, type CatalogAsset } from "@/components/catalog/asset-card";
import { getCurrentProfile } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Asset Bank",
};

const PAGE_SIZE = 24;

interface CatalogSearchParams {
  q?: string;
  type?: string;
  ks?: string;
  view?: string;
  page?: string;
}

export default async function CatalogPage({
  searchParams,
}: {
  searchParams: Promise<CatalogSearchParams>;
}) {
  const params = await searchParams;
  const supabase = await createClient();
  const profile = await getCurrentProfile();
  const view = params.view === "list" ? "list" : "grid";
  const page = Math.max(1, Number(params.page) || 1);
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  const [{ data: assetTypes }, { data: keyStages }] = await Promise.all([
    supabase.from("asset_types").select("id, name").order("sort_order"),
    supabase.from("key_stages").select("id, code").order("sort_order"),
  ]);

  // Facet filters that live on a join table are resolved to a plain list
  // of matching asset ids first, then applied with .in(...) — kept
  // separate from the main query so the select() stays a fixed, typed
  // string rather than one built dynamically per active filter.
  let keyStageAssetIds: string[] | null = null;
  if (params.ks) {
    const { data } = await supabase
      .from("asset_key_stages")
      .select("asset_id")
      .eq("key_stage_id", params.ks);
    keyStageAssetIds = (data ?? []).map((row) => row.asset_id);
  }

  let query = supabase
    .from("assets")
    .select("id, title, preview_thumb_path, asset_types(name)", {
      count: "exact",
    })
    .eq("status", "published");

  if (params.q) {
    query = query.textSearch("search_tsv", params.q, { type: "websearch" });
  }
  if (params.type) {
    query = query.eq("asset_type_id", params.type);
  }
  if (keyStageAssetIds !== null) {
    query = query.in("id", keyStageAssetIds);
  }

  const { data: assets, count } = await query
    .order("created_at", { ascending: false })
    .range(from, to);

  const rows = assets ?? [];
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
  if (profile && rows.length > 0) {
    const { data: favorites } = await supabase
      .from("favorites")
      .select("asset_id")
      .eq("profile_id", profile.id)
      .in(
        "asset_id",
        rows.map((asset) => asset.id),
      );
    favoritedIds = new Set((favorites ?? []).map((f) => f.asset_id));
  }

  const catalogAssets: CatalogAsset[] = rows.map((asset) => ({
    id: asset.id,
    title: asset.title,
    assetTypeName: asset.asset_types?.name ?? null,
    thumbUrl: asset.preview_thumb_path
      ? (signedUrlByPath.get(asset.preview_thumb_path) ?? null)
      : null,
    isFavorited: favoritedIds.has(asset.id),
  }));

  const totalPages = count ? Math.max(1, Math.ceil(count / PAGE_SIZE)) : 1;

  function pageHref(overrides: Partial<CatalogSearchParams>) {
    const next = new URLSearchParams();
    const merged = { ...params, ...overrides };
    if (merged.q) next.set("q", merged.q);
    if (merged.type) next.set("type", merged.type);
    if (merged.ks) next.set("ks", merged.ks);
    if (merged.view) next.set("view", merged.view);
    if (merged.page && merged.page !== "1") next.set("page", merged.page);
    const qs = next.toString();
    return qs ? `/?${qs}` : "/";
  }

  return (
    <main className="mx-auto max-w-5xl space-y-6 px-6 py-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Catalog</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          {count ?? 0} published asset{count === 1 ? "" : "s"}
        </p>
      </div>

      <form method="get" className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1">
          <label
            htmlFor="catalog-search"
            className="text-muted-foreground text-xs font-medium"
          >
            Search
          </label>
          <input
            id="catalog-search"
            type="search"
            name="q"
            defaultValue={params.q ?? ""}
            placeholder="Title or description"
            className="border-input bg-background h-9 w-56 rounded-md border px-3 text-sm"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label
            htmlFor="catalog-type"
            className="text-muted-foreground text-xs font-medium"
          >
            Asset type
          </label>
          <select
            id="catalog-type"
            name="type"
            defaultValue={params.type ?? ""}
            className="border-input bg-background h-9 rounded-md border px-2 text-sm"
          >
            <option value="">All types</option>
            {(assetTypes ?? []).map((type) => (
              <option key={type.id} value={type.id}>
                {type.name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label
            htmlFor="catalog-ks"
            className="text-muted-foreground text-xs font-medium"
          >
            Key Stage
          </label>
          <select
            id="catalog-ks"
            name="ks"
            defaultValue={params.ks ?? ""}
            className="border-input bg-background h-9 rounded-md border px-2 text-sm"
          >
            <option value="">All Key Stages</option>
            {(keyStages ?? []).map((ks) => (
              <option key={ks.id} value={ks.id}>
                {ks.code}
              </option>
            ))}
          </select>
        </div>
        {view === "list" && <input type="hidden" name="view" value="list" />}
        <button
          type="submit"
          className="border-input hover:bg-accent h-9 rounded-md border px-3 text-sm"
        >
          Filter
        </button>
      </form>

      <div className="flex items-center gap-2 text-sm">
        <Link
          href={pageHref({ view: undefined, page: undefined })}
          className={
            view === "grid"
              ? "text-foreground font-medium"
              : "text-muted-foreground hover:text-foreground"
          }
        >
          Grid
        </Link>
        <span className="text-muted-foreground">·</span>
        <Link
          href={pageHref({ view: "list", page: undefined })}
          className={
            view === "list"
              ? "text-foreground font-medium"
              : "text-muted-foreground hover:text-foreground"
          }
        >
          List
        </Link>
      </div>

      {catalogAssets.length === 0 ? (
        <p className="text-muted-foreground py-12 text-center text-sm">
          No assets match these filters.
        </p>
      ) : view === "grid" ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
          {catalogAssets.map((asset) => (
            <AssetCard key={asset.id} asset={asset} view="grid" />
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {catalogAssets.map((asset) => (
            <AssetCard key={asset.id} asset={asset} view="list" />
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-4 text-sm">
          {page > 1 && (
            <Link
              href={pageHref({ page: String(page - 1) })}
              className="text-muted-foreground hover:text-foreground"
            >
              Previous
            </Link>
          )}
          <span className="text-muted-foreground">
            Page {page} of {totalPages}
          </span>
          {page < totalPages && (
            <Link
              href={pageHref({ page: String(page + 1) })}
              className="text-muted-foreground hover:text-foreground"
            >
              Next
            </Link>
          )}
        </div>
      )}
    </main>
  );
}
