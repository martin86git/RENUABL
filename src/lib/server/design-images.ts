/**
 * Server only. Makes a picture a business uploads safe to keep and to show
 * to its customers.
 *
 * A file is never kept as it arrived. What it is, is read from its own first
 * bytes (JPEG, PNG or WebP; never SVG, which can carry script), then the
 * picture is drawn again from its pixels: that drops everything else a file
 * can hold (where a photo was taken, the camera, anything hidden after the
 * picture), turns it the right way up, and makes it no larger than it needs
 * to be. A logo is kept as PNG so a see-through background stays; photos are
 * kept as JPEG. Both are kinds the PDF can use.
 */
import sharp from "sharp";
import { IMAGE_LIMITS, IMAGE_TOO_BIG, IMAGE_WRONG, sniffImage, type ImageKind } from "@/lib/domain/design/brand";

export interface SafeImage {
  bytes: Buffer;
  contentType: "image/png" | "image/jpeg";
  width: number;
  height: number;
}

/** The picture made safe and small, or the message to show when it can't be used. */
export async function safeImage(file: Uint8Array, kind: ImageKind): Promise<SafeImage | { problem: string }> {
  if (file.length > IMAGE_LIMITS.uploadBytes) return { problem: IMAGE_TOO_BIG };
  if (!sniffImage(file)) return { problem: IMAGE_WRONG };
  try {
    const side = IMAGE_LIMITS.side[kind];
    // limitInputPixels: a small file that unpacks to an enormous picture is refused rather than drawn.
    const drawn = sharp(file, { limitInputPixels: 60_000_000, animated: false })
      .rotate()
      .resize({ width: side, height: side, fit: "inside", withoutEnlargement: true });
    const { data, info } =
      kind === "logo"
        ? await drawn.png({ compressionLevel: 9 }).toBuffer({ resolveWithObject: true })
        : await drawn.flatten({ background: "#ffffff" }).jpeg({ quality: 84, mozjpeg: true }).toBuffer({ resolveWithObject: true });
    return { bytes: data, contentType: kind === "logo" ? "image/png" : "image/jpeg", width: info.width, height: info.height };
  } catch {
    return { problem: IMAGE_WRONG };
  }
}

/** A picture sent to a browser: its own kind and nothing else, never guessed at, kept by the browser (a picture never changes under its id). */
export function imageResponse(image: { bytes: Buffer; contentType: string }): Response {
  return new Response(new Uint8Array(image.bytes), {
    headers: {
      "content-type": image.contentType,
      "x-content-type-options": "nosniff",
      "content-disposition": "inline",
      "cache-control": "private, max-age=31536000, immutable",
    },
  });
}

/**
 * A business's terms and conditions PDF, sent to a browser. A PDF can't be
 * redrawn the way a picture is, so it is never shown inside our pages: it is
 * handed over as a download under a plain name, its kind never guessed at, and
 * with a policy that lets nothing in it run if a browser opens it anyway.
 */
export function termsResponse(file: { bytes: Buffer }, name: string): Response {
  const plain = name.replace(/[^\w .()-]/g, "").trim() || "Terms and conditions";
  return new Response(new Uint8Array(file.bytes), {
    headers: {
      "content-type": "application/pdf",
      "x-content-type-options": "nosniff",
      "content-disposition": `attachment; filename="${plain}.pdf"`,
      "content-security-policy": "sandbox; default-src 'none'",
      "cache-control": "private, max-age=3600",
    },
  });
}
