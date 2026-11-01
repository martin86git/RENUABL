import { KEEP_SHEET_BYTES, cleanSku, type SheetKind } from "@/lib/domain/design/datasheets";
import { isPdf } from "@/lib/domain/design/brand";
import { SHEET_TYPES } from "@/lib/server/datasheet-reader";
import { answer, requireMember } from "@/lib/server/design-context";
import { putSheetFile, sheetFile } from "@/lib/server/design-datasheets-repo";

const kindOf = (v: unknown): SheetKind | null => (v === "panel" || v === "inverter" ? v : null);

/** What a kept sheet's bytes say it is: a PDF, or a JPEG, PNG or WebP picture (never what the browser says). */
function sniff(bytes: Uint8Array): string | null {
  if (isPdf(bytes)) return "application/pdf";
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return "image/png";
  if (String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP") return "image/webp";
  return null;
}

/** GET ?kind=&sku=: a product's datasheet as it was uploaded, for any member to open again. */
export async function GET(request: Request) {
  return answer(async () => {
    const who = await requireMember("design");
    if ("refuse" in who) return who.refuse;
    const q = new URL(request.url).searchParams;
    const kind = kindOf(q.get("kind"));
    const sku = cleanSku(q.get("sku"));
    const file = kind && sku ? await sheetFile(who.member.businessId, kind, sku) : null;
    if (!file) return new Response("Not found", { status: 404 });
    const name = file.fileName || `${sku}${file.type === "application/pdf" ? ".pdf" : ""}`;
    return new Response(new Uint8Array(file.bytes), {
      headers: {
        "content-type": file.type,
        "content-disposition": `inline; filename*=UTF-8''${encodeURIComponent(name)}`,
        "cache-control": "private, max-age=3600",
        "x-content-type-options": "nosniff",
        "content-security-policy": "sandbox; default-src 'none'; img-src 'self'",
      },
    });
  });
}

/** POST a form of kind, sku and file: keeps the sheet with that product's saved figures. */
export async function POST(request: Request) {
  return answer(async () => {
    const who = await requireMember("prices");
    if ("refuse" in who) return who.refuse;
    const form = await request.formData().catch(() => null);
    const kind = kindOf(form?.get("kind"));
    const sku = cleanSku(form?.get("sku"));
    const file = form?.get("file");
    if (!kind || !sku || !(file instanceof File) || file.size === 0)
      return Response.json({ ok: false, message: "Choose the datasheet to keep." }, { status: 400 });
    if (file.size > KEEP_SHEET_BYTES)
      return Response.json({ ok: false, message: "The figures are saved, but the sheet is over 4 MB so it isn't kept." }, { status: 413 });
    const bytes = new Uint8Array(await file.arrayBuffer());
    const type = sniff(bytes);
    if (!type || !(SHEET_TYPES as readonly string[]).includes(type))
      return Response.json({ ok: false, message: "Keep a PDF, or a JPG, PNG or WebP picture." }, { status: 415 });
    if (!(await putSheetFile(who.member.businessId, kind, sku, Buffer.from(bytes), type)))
      return Response.json({ ok: false, message: "Save the product's figures first." }, { status: 404 });
    return Response.json({ ok: true });
  });
}
