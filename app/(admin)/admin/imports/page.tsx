import type { Metadata } from "next";
import Link from "next/link";

import { UploadForm } from "@/components/imports/upload-form";
import { IMPORT_KIND_LABELS, type ImportKind } from "@/lib/import/kinds";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Imports — Asset Bank",
};

const KINDS: ImportKind[] = ["assets", "characters", "lessons"];

export default async function ImportsPage() {
  const supabase = await createClient();
  const { data: batches } = await supabase
    .from("import_batches")
    .select(
      "id, kind, filename, status, row_count, valid_count, error_count, created_at",
    )
    .order("created_at", { ascending: false })
    .limit(50);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Imports</h1>
        <p className="text-muted-foreground text-sm">
          Spreadsheet batch import. Every imported row lands as a draft —
          imports never publish, never create taxonomy terms, and never touch
          Google Drive.
        </p>
      </div>

      {KINDS.map((kind) => (
        <section key={kind} className="space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">
              {IMPORT_KIND_LABELS[kind]}
            </h2>
            <a
              href={`/admin/imports/template/${kind}`}
              className="text-muted-foreground hover:text-foreground text-xs underline"
            >
              Download template
            </a>
          </div>
          <UploadForm kind={kind} />
        </section>
      ))}

      <section className="space-y-2">
        <h2 className="text-sm font-semibold">Recent batches</h2>
        <div className="border-border overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted text-muted-foreground text-left text-xs uppercase">
              <tr>
                <th className="px-4 py-2">Filename</th>
                <th className="px-4 py-2">Kind</th>
                <th className="px-4 py-2">Status</th>
                <th className="px-4 py-2">Rows</th>
                <th className="px-4 py-2">Valid</th>
                <th className="px-4 py-2">Errors</th>
              </tr>
            </thead>
            <tbody>
              {(batches ?? []).map((batch) => (
                <tr key={batch.id} className="border-border border-t">
                  <td className="px-4 py-2">
                    <Link
                      href={`/admin/imports/${batch.id}`}
                      className="underline"
                    >
                      {batch.filename}
                    </Link>
                  </td>
                  <td className="px-4 py-2">
                    {IMPORT_KIND_LABELS[batch.kind]}
                  </td>
                  <td className="px-4 py-2 capitalize">{batch.status}</td>
                  <td className="px-4 py-2">{batch.row_count}</td>
                  <td className="px-4 py-2">{batch.valid_count}</td>
                  <td className="px-4 py-2">{batch.error_count}</td>
                </tr>
              ))}
              {(batches ?? []).length === 0 && (
                <tr>
                  <td
                    colSpan={6}
                    className="text-muted-foreground px-4 py-6 text-center"
                  >
                    No imports yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
