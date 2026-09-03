"use client";

import { type ChangeEvent, useState } from "react";
import { useRouter } from "next/navigation";

import {
  recordPreviewUpload,
  requestPreviewUploadUrls,
} from "@/app/(admin)/admin/assets/actions";
import { createPreviewDerivatives } from "@/lib/images";
import { createClient } from "@/lib/supabase/client";

export function PreviewUploader({ assetId }: { assetId: string }) {
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setError(null);

    try {
      const { display, thumb } = await createPreviewDerivatives(file);
      const { display: displayTarget, thumb: thumbTarget } =
        await requestPreviewUploadUrls({ assetId });

      const supabase = createClient();
      const [displayResult, thumbResult] = await Promise.all([
        supabase.storage
          .from("asset-previews")
          .uploadToSignedUrl(
            displayTarget.path,
            displayTarget.token,
            display.blob,
          ),
        supabase.storage
          .from("asset-previews")
          .uploadToSignedUrl(thumbTarget.path, thumbTarget.token, thumb.blob),
      ]);

      if (displayResult.error) throw new Error(displayResult.error.message);
      if (thumbResult.error) throw new Error(thumbResult.error.message);

      await recordPreviewUpload({
        assetId,
        previewPath: displayTarget.path,
        previewThumbPath: thumbTarget.path,
        previewWidth: display.width,
        previewHeight: display.height,
        previewBytes: display.blob.size,
      });

      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to upload preview");
    } finally {
      setIsUploading(false);
      event.target.value = "";
    }
  }

  return (
    <div className="space-y-1">
      <input
        type="file"
        accept="image/png,image/jpeg,image/webp"
        disabled={isUploading}
        onChange={handleChange}
        className="text-sm"
      />
      {isUploading && (
        <p className="text-muted-foreground text-xs">Uploading…</p>
      )}
      {error && (
        <p role="alert" className="text-destructive text-xs">
          {error}
        </p>
      )}
    </div>
  );
}
