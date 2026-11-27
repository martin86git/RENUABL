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

/** The side of a phone assistant's picture, kept square. */
export const AVATAR_SIDE = 320;

/** A face for the phone assistant: the picture checked as any other, then cut square from its middle and kept small. */
export async function avatarImage(file: Uint8Array): Promise<SafeImage | { problem: string }> {
  if (file.length > IMAGE_LIMITS.uploadBytes) return { problem: IMAGE_TOO_BIG };
  if (!sniffImage(file)) return { problem: IMAGE_WRONG };
  try {
    const { data, info } = await sharp(file, { limitInputPixels: 60_000_000, animated: false })
      .rotate()
      .resize({ width: AVATAR_SIDE, height: AVATAR_SIDE, fit: "cover", position: "attention" })
      .flatten({ background: "#ffffff" })
      .jpeg({ quality: 86, mozjpeg: true })
      .toBuffer({ resolveWithObject: true });
    return { bytes: data, contentType: "image/jpeg", width: info.width, height: info.height };
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

/** A marketing email's picture: a photo kept as any other, or an animated GIF kept moving. */
export interface MarketingImage {
  bytes: Buffer;
  contentType: "image/png" | "image/jpeg" | "image/gif";
  width: number;
  height: number;
}

/** GIF's own first bytes: "GIF87a" or "GIF89a". */
export const isGif = (b: Uint8Array) =>
  b.length >= 6 && b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x38 && (b[4] === 0x37 || b[4] === 0x39) && b[5] === 0x61;

/**
 * A picture for a marketing email (22 Nov 2026, Martin: emails with animations, like the website's). A GIF, the one
 * animation email apps play, is drawn again frame by frame (its timing kept, anything else in the file dropped), no wider
 * than `MARKETING_GIF_SIDE`; anything else goes through `safeImage` as a photo.
 */
export const MARKETING_GIF_SIDE = 1200;

export async function marketingImage(file: Uint8Array): Promise<MarketingImage | { problem: string }> {
  if (!isGif(file)) return safeImage(file, "photo");
  if (file.length > IMAGE_LIMITS.uploadBytes) return { problem: IMAGE_TOO_BIG };
  try {
    const { data, info } = await sharp(file, { animated: true, limitInputPixels: 60_000_000 })
      .resize({ width: MARKETING_GIF_SIDE, withoutEnlargement: true })
      .gif({ effort: 7 })
      .toBuffer({ resolveWithObject: true });
    return { bytes: data, contentType: "image/gif", width: info.width, height: info.pageHeight ?? info.height };
  } catch {
    return { problem: IMAGE_WRONG };
  }
}

/**
 * A dark logo on a clear ground, given a soft white glow behind its marks (27 Nov 2026, Martin: "on mobile, the
 * marketing emails, show the renuabl logo in black… might have something to do with dark mode"). A phone's mail app in
 * dark mode turns an email's white ground dark and leaves its pictures alone, so a black logo ends up black on dark, and
 * an email can't ask the app which it did. The glow can't be seen on white and outlines the logo on dark, so the one
 * picture reads on both. Anything else (no clear ground, a light or coloured logo, not a PNG) comes back as it was.
 */
export async function glowLogo(bytes: Buffer): Promise<Buffer> {
  try {
    const { data, info } = await sharp(bytes).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    if (info.channels !== 4) return bytes;
    const pixels = info.width * info.height;
    let clear = 0;
    let weight = 0;
    let light = 0;
    for (let i = 0; i < data.length; i += 4) {
      const a = data[i + 3];
      if (a < 16) clear++;
      if (a < 128) continue;
      weight++;
      light += 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
    }
    // Needs a clear ground round it (a fifth of the picture or more) and marks that are dark on the whole.
    if (!weight || clear / pixels < 0.2 || light / weight > 96) return bytes;
    const alpha = Buffer.alloc(pixels);
    for (let i = 0; i < pixels; i++) alpha[i] = data[i * 4 + 3];
    // How far the glow reaches: about a twentieth of the logo's height, so it scales with the size it is shown at.
    const reach = Math.max(1.2, info.height / 22);
    const spread = await sharp(alpha, { raw: { width: info.width, height: info.height, channels: 1 } })
      .blur(reach / 2)
      .linear(5, 0)
      .raw()
      .toBuffer({ resolveWithObject: true });
    // The blurred shape comes back with as many channels as the library chose: read the first of each pixel.
    const step = spread.info.channels;
    const glow = Buffer.alloc(pixels * 4, 255);
    for (let i = 0; i < pixels; i++) glow[i * 4 + 3] = Math.round(spread.data[i * step] * 0.92);
    return await sharp(glow, { raw: { width: info.width, height: info.height, channels: 4 } })
      .composite([{ input: bytes }])
      .png({ compressionLevel: 9 })
      .toBuffer();
  } catch {
    return bytes;
  }
}
