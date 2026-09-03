import type { Metadata } from "next";
import Link from "next/link";

import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Assets — Asset Bank",
};

export default async function AssetsPage() {
  const supabase = await createClient();
  const { data: assets } = await supabase
    .from("assets")
    .select("id, title, status, asset_types(name)")
    .order("created_at", { ascending: false });

  const rows = assets ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Assets</h1>
          <p className="text-muted-foreground text-sm">
            Every draft, published, and archived asset.
          </p>
        </div>
        <Link
          href="/admin/assets/new"
          className="bg-primary text-primary-foreground flex h-10 shrink-0 items-center rounded-md px-4 py-2 text-sm font-medium whitespace-nowrap hover:opacity-90"
        >
          New asset
        </Link>
      </div>

      <div className="border-border overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-muted text-muted-foreground text-left text-xs uppercase">
            <tr>
              <th className="px-4 py-2">Title</th>
              <th className="px-4 py-2">Type</th>
              <th className="px-4 py-2">Status</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody>
            {rows.map((asset) => (
              <tr key={asset.id} className="border-border border-t">
                <td className="px-4 py-2">{asset.title}</td>
                <td className="px-4 py-2">{asset.asset_types?.name}</td>
                <td className="px-4 py-2 capitalize">{asset.status}</td>
                <td className="px-4 py-2 text-right">
                  <Link
                    href={`/admin/assets/${asset.id}/edit`}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    Edit
                  </Link>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td
                  colSpan={4}
                  className="text-muted-foreground px-4 py-6 text-center"
                >
                  No assets yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
