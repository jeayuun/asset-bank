import type { Metadata } from "next";
import { Fragment } from "react";
import { notFound } from "next/navigation";

import { MergeForm } from "@/components/taxonomy/merge-form";
import { TermForm } from "@/components/taxonomy/term-form";
import { TermRowActions } from "@/components/taxonomy/term-row-actions";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Taxonomy — Asset Bank",
};

export default async function TaxonomyDetailPage({
  params,
}: {
  params: Promise<{ taxonomyId: string }>;
}) {
  const { taxonomyId } = await params;
  const supabase = await createClient();

  const { data: taxonomy } = await supabase
    .from("taxonomies")
    .select("id, name, is_closed, is_hierarchical")
    .eq("id", taxonomyId)
    .maybeSingle();

  if (!taxonomy) {
    notFound();
  }

  const { data: terms } = await supabase
    .from("taxonomy_terms")
    .select("id, name, parent_id, is_active")
    .eq("taxonomy_id", taxonomyId)
    .order("sort_order")
    .order("name");

  const rows = terms ?? [];
  const topLevel = rows.filter((t) => t.parent_id === null);
  const childrenOf = (parentId: string) =>
    rows.filter((t) => t.parent_id === parentId);
  const activeTerms = rows.filter((t) => t.is_active);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">
          {taxonomy.name}
        </h1>
        <p className="text-muted-foreground text-sm">
          Add, rename, deactivate, or merge terms.
        </p>
      </div>

      <TermForm
        taxonomyId={taxonomy.id}
        isClosed={taxonomy.is_closed}
        parentOptions={
          taxonomy.is_hierarchical
            ? topLevel
                .filter((t) => t.is_active)
                .map((t) => ({ id: t.id, name: t.name }))
            : undefined
        }
      />

      <div className="border-border overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-muted text-muted-foreground text-left text-xs uppercase">
            <tr>
              <th className="px-4 py-2">Name</th>
              <th className="px-4 py-2">Status</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody>
            {topLevel.map((term) => (
              <Fragment key={term.id}>
                <tr key={term.id} className="border-border border-t">
                  <td className="px-4 py-2">{term.name}</td>
                  <td className="px-4 py-2">
                    {term.is_active ? "Active" : "Inactive"}
                  </td>
                  <td className="px-4 py-2 text-right">
                    <TermRowActions
                      termId={term.id}
                      name={term.name}
                      isActive={term.is_active}
                    />
                  </td>
                </tr>
                {childrenOf(term.id).map((child) => (
                  <tr key={child.id} className="border-border border-t">
                    <td className="text-muted-foreground py-2 pr-4 pl-8">
                      ↳ {child.name}
                    </td>
                    <td className="px-4 py-2">
                      {child.is_active ? "Active" : "Inactive"}
                    </td>
                    <td className="px-4 py-2 text-right">
                      <TermRowActions
                        termId={child.id}
                        name={child.name}
                        isActive={child.is_active}
                      />
                    </td>
                  </tr>
                ))}
              </Fragment>
            ))}
            {rows.length === 0 && (
              <tr>
                <td
                  colSpan={3}
                  className="text-muted-foreground px-4 py-6 text-center"
                >
                  No terms yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <MergeForm terms={activeTerms.map((t) => ({ id: t.id, name: t.name }))} />
    </div>
  );
}
