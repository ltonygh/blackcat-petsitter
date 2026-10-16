import sharp from "sharp";

import type { AllowedMimeType } from "./documents";
import { IMAGE_MAX_DIMENSION } from "./documents";

/**
 * Magic-byte signatures. We validate the actual bytes, not the declared mime
 * type, because the client can lie about Content-Type.
 */
const SIGNATURES: Record<"jpeg" | "png" | "pdf", number[]> = {
  jpeg: [0xff, 0xd8, 0xff],
  png: [0x89, 0x50, 0x4e, 0x47],
  pdf: [0x25, 0x50, 0x44, 0x46],
};

function matchesPrefix(bytes: Uint8Array, signature: number[]): boolean {
  if (bytes.length < signature.length) return false;
  return signature.every((b, i) => bytes[i] === b);
}

/** Sniff the real file type from the leading bytes. */
export function sniffMagicBytes(
  bytes: Uint8Array,
): "jpeg" | "png" | "pdf" | null {
  if (matchesPrefix(bytes, SIGNATURES.jpeg)) return "jpeg";
  if (matchesPrefix(bytes, SIGNATURES.png)) return "png";
  if (matchesPrefix(bytes, SIGNATURES.pdf)) return "pdf";
  return null;
}

/**
 * Map a declared mime type to the magic-byte kind that must be present.
 */
function expectedKind(mimeType: AllowedMimeType): "jpeg" | "png" | "pdf" {
  switch (mimeType) {
    case "image/jpeg":
      return "jpeg";
    case "image/png":
      return "png";
    case "application/pdf":
      return "pdf";
  }
}

/**
 * Validate that the first bytes of an object match its declared mime type.
 * Guards against polyglot/mislabelled uploads.
 */
export function validateMagicBytes(
  mimeType: AllowedMimeType,
  bytes: Uint8Array,
): boolean {
  const kind = sniffMagicBytes(bytes);
  return kind !== null && kind === expectedKind(mimeType);
}

/**
 * Re-encode an image with sharp.
 *
 * - Resizes so the longest side is at most IMAGE_MAX_DIMENSION (never upscales).
 * - Re-encodes to JPEG (quality 85) or PNG, which strips EXIF metadata,
 *   embedded scripts and polyglot payloads as a side effect of decoding and
 *   re-encoding through libvips.
 *
 * Returns the re-encoded bytes and their size. PDFs are NOT passed here.
 */
export async function reencodeImage(
  input: Buffer,
  mimeType: "image/jpeg" | "image/png",
): Promise<{ data: Buffer; size: number }> {
  const pipeline = sharp(input, { failOn: "error" }).rotate().resize({
    width: IMAGE_MAX_DIMENSION,
    height: IMAGE_MAX_DIMENSION,
    fit: "inside",
    withoutEnlargement: true,
  });

  const output =
    mimeType === "image/png"
      ? await pipeline.png().toBuffer()
      : await pipeline.jpeg({ quality: 85 }).toBuffer();

  return { data: output, size: output.length };
}
