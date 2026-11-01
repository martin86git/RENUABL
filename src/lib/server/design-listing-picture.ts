/**
 * Server only. Draws a job listing's roof picture (domain/design/listing-picture.ts): the satellite photo, blurred
 * past recognition and darkened everywhere but the roof, with the panel layout over it, as a PNG. The blur is done on
 * a photo shrunk to an eighth and blown up again, so neighbouring homes, cars and the street become soft colour. Sharp
 * writes no location or camera data into what it makes. Null when the design has no panels; without a photo (no
 * Google key), the panels on a plain ground.
 */
import sharp from "sharp";
import { listingDrawing, listingPictureSvg } from "@/lib/domain/design/listing-picture";
import { ROOF_IMAGE, type RoofDesign } from "@/lib/domain/design/roof-design";
import { satelliteImage } from "./roof-view";

async function photo(design: RoofDesign, address: string): Promise<Buffer | null> {
  try {
    const res = await satelliteImage({ line: address, suburb: "", state: "", postcode: "", lat: design.lat, lng: design.lng }, "designer");
    return res ? Buffer.from(await res.arrayBuffer()) : null;
  } catch {
    return null;
  }
}

const dataUrl = (png: Buffer) => `data:image/png;base64,${png.toString("base64")}`;

export async function listingPicture(design: RoofDesign, address: string): Promise<Buffer | null> {
  const drawn = listingDrawing(design);
  if (!drawn) return null;
  try {
    const raw = await photo(design, address);
    let sharpUrl: string | null = null;
    let blurredUrl: string | null = null;
    if (raw) {
      const W = ROOF_IMAGE.width * 2;
      const H = ROOF_IMAGE.height * 2;
      const base = await sharp(raw).resize(W, H, { fit: "fill" }).png().toBuffer();
      const small = await sharp(base)
        .resize(W / 8, H / 8)
        .blur(2.5)
        .png()
        .toBuffer();
      const blurred = await sharp(small).resize(W, H, { kernel: "cubic" }).blur(6).png().toBuffer();
      sharpUrl = dataUrl(base);
      blurredUrl = dataUrl(blurred);
    }
    const svg = listingPictureSvg({ ...drawn, sharp: sharpUrl, blurred: blurredUrl });
    return await sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toBuffer();
  } catch (e) {
    console.error("listing picture failed", e instanceof Error ? e.message : e);
    return null;
  }
}
