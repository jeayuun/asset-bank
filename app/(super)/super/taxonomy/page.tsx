import type { Metadata } from "next";
import Link from "next/link";

import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Taxonomy — Asset Bank",
};

export default async function TaxonomyListPage() {
  const supabase = await createClient();
  const { data: taxonomies } = await supabase
    .from("taxonomies")
    .select("id, slug, name, is_multi, is_hierarchical, is_closed, is_system")
    .order("sort_order");

  const rows = taxonomies ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Taxonomy</h1>
        <p className="text-muted-foreground text-sm">
          Editable facets used across characters and other asset types.
        </p>
      </div>

      <div className="border-border overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-muted text-muted-foreground text-left text-xs uppercase">
            <tr>
              <th className="px-4 py-2">Name</th>
              <th className="px-4 py-2">Multi</th>
              <th className="px-4 py-2">Hierarchical</th>
              <th className="px-4 py-2">Closed</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody>
            {rows.map((taxonomy) => (
              <tr key={taxonomy.id} className="border-border border-t">
                <td className="px-4 py-2">{taxonomy.name}</td>
                <td className="px-4 py-2">
                  {taxonomy.is_multi ? "Yes" : "No"}
                </td>
                <td className="px-4 py-2">
                  {taxonomy.is_hierarchical ? "Yes" : "No"}
                </td>
                <td className="px-4 py-2">
                  {taxonomy.is_closed ? "Yes" : "No"}
                </td>
                <td className="px-4 py-2 text-right">
                  <Link
                    href={`/super/taxonomy/${taxonomy.id}`}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    Manage terms
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
