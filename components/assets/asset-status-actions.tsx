"use client";

import { useState, useTransition } from "react";

import {
  archiveAsset,
  publishAsset,
  restoreAsset,
  unpublishAsset,
} from "@/app/(admin)/admin/assets/actions";
import { Button } from "@/components/ui/button";

export function AssetStatusActions({
  assetId,
  status,
}: {
  assetId: string;
  status: "draft" | "published" | "archived";
}) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function run(action: (input: unknown) => Promise<void>) {
    setError(null);
    startTransition(async () => {
      try {
        await action({ assetId });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Action failed");
      }
    });
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {status === "draft" && (
          <>
            <Button
              type="button"
              disabled={isPending}
              onClick={() => run(publishAsset)}
            >
              Publish
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={isPending}
              onClick={() => run(archiveAsset)}
            >
              Archive
            </Button>
          </>
        )}
        {status === "published" && (
          <>
            <Button
              type="button"
              variant="outline"
              disabled={isPending}
              onClick={() => run(unpublishAsset)}
            >
              Unpublish
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={isPending}
              onClick={() => run(archiveAsset)}
            >
              Archive
            </Button>
          </>
        )}
        {status === "archived" && (
          <>
            <Button
              type="button"
              disabled={isPending}
              onClick={() => run(restoreAsset)}
            >
              Restore to draft
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={isPending}
              onClick={() => run(publishAsset)}
            >
              Publish directly
            </Button>
          </>
        )}
      </div>
      {error && (
        <p role="alert" className="text-destructive text-xs">
          {error}
        </p>
      )}
    </div>
  );
}
