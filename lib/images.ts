/**
 * Client-side preview resizing (docs/BLUEPRINT.md §7). Runs in the
 * browser via createImageBitmap + canvas — avoids depending on Supabase's
 * paid image-transformation feature and cuts egress. Must run in a
 * browser context (Client Component).
 */

export interface ResizedImage {
  blob: Blob;
  width: number;
  height: number;
}

async function resizeToWebp(
  file: File | Blob,
  maxEdge: number,
  quality: number,
): Promise<ResizedImage> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Canvas 2D context unavailable");
  }
  ctx.drawImage(bitmap, 0, 0, width, height);

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/webp", quality),
  );
  if (!blob) {
    throw new Error("Failed to encode preview image");
  }

  return { blob, width, height };
}

export interface AssetPreviewDerivatives {
  display: ResizedImage;
  thumb: ResizedImage;
}

/** display: longest edge 1200px, q80. thumb: longest edge 400px, q75. */
export async function createPreviewDerivatives(
  file: File,
): Promise<AssetPreviewDerivatives> {
  const [display, thumb] = await Promise.all([
    resizeToWebp(file, 1200, 0.8),
    resizeToWebp(file, 400, 0.75),
  ]);
  return { display, thumb };
}
