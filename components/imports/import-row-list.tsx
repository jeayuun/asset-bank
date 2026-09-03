"use client";

import { useTransition } from "react";

import { setImportRowSkipped } from "@/app/(admin)/admin/imports/actions";

export interface ImportRowItem {
  id: string;
  rowNumber: number;
  status: string;
  errors: { column: string; message: string }[] | null;
  summary: string;
}

export function ImportRowList({
  batchId,
  rows,
}: {
  batchId: string;
  rows: ImportRowItem[];
}) {
  const [isPending, startTransition] = useTransition();

  return (
    <div className="border-border overflow-x-auto rounded-lg border">
      <table className="w-full text-sm">
        <thead className="bg-muted text-muted-foreground text-left text-xs uppercase">
          <tr>
            <th className="px-4 py-2">Row</th>
            <th className="px-4 py-2">Summary</th>
            <th className="px-4 py-2">Status</th>
            <th className="px-4 py-2">Notes</th>
            <th className="px-4 py-2" />
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="border-border border-t align-top">
              <td className="px-4 py-2 font-mono text-xs">{row.rowNumber}</td>
              <td className="px-4 py-2">{row.summary}</td>
              <td className="px-4 py-2 capitalize">{row.status}</td>
              <td className="px-4 py-2">
                {row.errors && row.errors.length > 0 && (
                  <ul className="space-y-0.5">
                    {row.errors.map((error, index) => (
                      <li
                        key={index}
                        className={
                          row.status === "invalid"
                            ? "text-destructive text-xs"
                            : "text-muted-foreground text-xs"
                        }
                      >
                        {error.column}: {error.message}
                      </li>
                    ))}
                  </ul>
                )}
              </td>
              <td className="px-4 py-2">
                {(row.status === "valid" || row.status === "skipped") && (
                  <label className="flex items-center gap-1.5 text-xs">
                    <input
                      type="checkbox"
                      disabled={isPending}
                      checked={row.status === "valid"}
                      onChange={(event) =>
                        startTransition(() =>
                          setImportRowSkipped({
                            batchId,
                            rowId: row.id,
                            skipped: !event.target.checked,
                          }),
                        )
                      }
                    />
                    Include
                  </label>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
