// Browser-only: shrinks a picked photo to the square picture that is uploaded.

/** Larger files are refused before decoding, to keep memory use sane on phones. */
const MAX_SOURCE_BYTES = 20 * 1024 * 1024;
const SIDES = [512, 384, 256];
const QUALITIES = [0.86, 0.78, 0.7, 0.62, 0.54];

export class AvatarResizeError extends Error {}

async function decode(file: Blob): Promise<CanvasImageSource & { width: number; height: number }> {
  if (typeof createImageBitmap === "function") {
    return createImageBitmap(file);
  }

  const url = URL.createObjectURL(file);

  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    return image;
  } finally {
    URL.revokeObjectURL(url);
  }
}

function toBlob(canvas: HTMLCanvasElement, type: string, quality: number) {
  return new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, quality));
}

/**
 * Center-crops the photo to a square and encodes it as WebP (JPEG where the
 * browser cannot encode WebP), lowering quality and then size until it fits
 * `maxBytes`.
 */
export async function resizeAvatar(file: Blob, maxBytes: number): Promise<Blob> {
  if (!file.type.startsWith("image/")) {
    throw new AvatarResizeError("Choose an image file.");
  }

  if (file.size > MAX_SOURCE_BYTES) {
    throw new AvatarResizeError("The image must be 20 MB or smaller.");
  }

  let source: Awaited<ReturnType<typeof decode>>;

  try {
    source = await decode(file);
  } catch {
    throw new AvatarResizeError("This image could not be read. Use a PNG, JPEG or WebP file.");
  }

  const crop = Math.min(source.width, source.height);
  const sourceX = (source.width - crop) / 2;
  const sourceY = (source.height - crop) / 2;
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");

  if (!context || crop === 0) {
    throw new AvatarResizeError("This image could not be read. Use a PNG, JPEG or WebP file.");
  }

  for (const side of SIDES) {
    const target = Math.min(side, crop);
    canvas.width = target;
    canvas.height = target;
    // JPEG has no transparency; a white backdrop beats black corners.
    context.fillStyle = "#fff";
    context.fillRect(0, 0, target, target);
    context.imageSmoothingQuality = "high";
    context.drawImage(source, sourceX, sourceY, crop, crop, 0, 0, target, target);

    for (const quality of QUALITIES) {
      let blob = await toBlob(canvas, "image/webp", quality);

      // Browsers that cannot encode WebP silently fall back to PNG.
      if (blob?.type !== "image/webp") {
        blob = await toBlob(canvas, "image/jpeg", quality);
      }

      if (blob && blob.size <= maxBytes) {
        return blob;
      }
    }
  }

  throw new AvatarResizeError("This image could not be made small enough. Try another photo.");
}
