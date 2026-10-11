import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { IMAGE_TOO_BIG, IMAGE_WRONG } from "@/lib/domain/design/brand";
import { buildProposal } from "@/lib/domain/design/proposal";
import { sampleInputs } from "@/lib/domain/design/proposal-fixture";
import { imageResponse, safeImage } from "./design-images";
import { pdfName, proposalPdf } from "./proposal-pdf";

const photo = (width: number, height: number) => sharp({ create: { width, height, channels: 3, background: { r: 30, g: 90, b: 160 } } });

describe("a picture a business uploads", () => {
  it("is drawn again smaller, and nothing but the picture is kept", async () => {
    // A photo carrying where it was taken and a comment, as a phone's would.
    const original = await photo(3000, 2000)
      .withExif({
        IFD0: { ImageDescription: "SECRET-NOTE", Copyright: "SECRET-OWNER" },
        IFD3: { GPSLatitudeRef: "S", GPSLongitudeRef: "E" },
      })
      .jpeg()
      .toBuffer();
    expect(original.includes("SECRET-NOTE")).toBe(true);
    const safe = await safeImage(original, "photo");
    if ("problem" in safe) throw new Error(safe.problem);
    expect(safe).toMatchObject({ contentType: "image/jpeg", width: 1600, height: 1067 });
    expect(safe.bytes.includes("SECRET-NOTE") || safe.bytes.includes("SECRET-OWNER")).toBe(false);
    const meta = await sharp(safe.bytes).metadata();
    expect(meta.exif).toBeUndefined();
    expect(meta.format).toBe("jpeg");
  });
  it("keeps a logo's see-through background, as a PNG no larger than a logo needs", async () => {
    const logo = await sharp({ create: { width: 2000, height: 500, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
      .png()
      .toBuffer();
    const safe = await safeImage(logo, "logo");
    if ("problem" in safe) throw new Error(safe.problem);
    expect(safe).toMatchObject({ contentType: "image/png", width: 800, height: 200 });
    expect((await sharp(safe.bytes).metadata()).hasAlpha).toBe(true);
    // A small one is never blown up.
    const small = await safeImage(await photo(120, 40).png().toBuffer(), "logo");
    expect(small).toMatchObject({ width: 120, height: 40 });
  });
  it("turns a WebP into a kind the PDF can use", async () => {
    const safe = await safeImage(await photo(400, 300).webp().toBuffer(), "cover");
    expect(safe).toMatchObject({ contentType: "image/jpeg", width: 400, height: 300 });
  });
  it("refuses what isn't a picture we take, whatever it is called", async () => {
    const svg = new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>');
    expect(await safeImage(svg, "logo")).toEqual({ problem: IMAGE_WRONG });
    expect(await safeImage(new TextEncoder().encode("GIF89a not really"), "photo")).toEqual({ problem: IMAGE_WRONG });
    // The right first bytes and nothing behind them.
    expect(await safeImage(new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 4]), "photo")).toEqual({ problem: IMAGE_WRONG });
    expect(await safeImage(new Uint8Array(5 * 1024 * 1024 + 1), "photo")).toEqual({ problem: IMAGE_TOO_BIG });
  });
  it("is sent as its own kind and nothing else", () => {
    const res = imageResponse({ bytes: Buffer.from([1, 2, 3]), contentType: "image/png" });
    expect(res.headers.get("content-type")).toBe("image/png");
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
  });
});

describe("the proposal as a PDF", () => {
  it("is a real PDF file, made from the customer's copy alone", async () => {
    const built = buildProposal(sampleInputs({ withBattery: true }));
    if (!built.ok) throw new Error(built.problems.join(" "));
    const logo = await safeImage(await photo(600, 200).png().toBuffer(), "logo");
    const cover = await safeImage(await photo(1800, 800).jpeg().toBuffer(), "cover");
    if ("problem" in logo || "problem" in cover) throw new Error("unexpected");
    const images = { [built.view.business.logo!.id]: logo, [built.view.business.cover!.id]: cover };

    const pdf = await proposalPdf(built.view, images, null);
    expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
    expect(pdf.length).toBeGreaterThan(5000);
    // Signed, it carries who accepted; and it is made without its pictures when they can't be had.
    const signed = await proposalPdf(built.view, {}, { name: "Alex Example", at: "2026-10-13T02:00:00.000Z" });
    expect(signed.subarray(0, 5).toString()).toBe("%PDF-");
    // The function takes the customer's copy and nothing else: there is no way to hand it the business's record.
    expect(proposalPdf.length).toBe(3);
  }, 30_000);
  it("is named for the customer, with nothing a file name can't hold", () => {
    expect(pdfName({ customer: { name: "Alex Example", address: "" } })).toBe("Proposal - Alex Example.pdf");
    expect(pdfName({ customer: { name: 'A/B\\C:"*?<>|', address: "" } })).toBe("Proposal - ABC.pdf");
    expect(pdfName({ customer: { name: "///", address: "" } })).toBe("Proposal - customer.pdf");
  });
});
