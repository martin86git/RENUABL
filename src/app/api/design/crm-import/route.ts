import { IMPORT_LIMITS, cleanImportMode, cleanImportRow, type ImportRow } from "@/lib/domain/design/crm-import";
import { answer, requireMember } from "@/lib/server/design-context";
import { bringInSheetRows } from "@/lib/server/design-crm-import";
import { allow } from "@/lib/server/rate-limit";
import { readXlsxRows } from "@/lib/server/xlsx";

export const maxDuration = 120;

/**
 * Bringing contacts and deals in from an export sheet (Settings → CRM → Bring in contacts and deals;
 * domain/design/crm-import.ts), for a member who may change settings.
 * POST a form with `file` (an Excel sheet): its rows read and answered, nothing kept. A CSV is read in the browser.
 * POST JSON { rows, mode, sheet }: a batch of rows (read in the browser, read again here) brought in.
 */
export async function POST(request: Request) {
  return answer(async () => {
    const who = await requireMember("prices");
    if ("refuse" in who) return who.refuse;
    if (!allow(request, "design-crm-import", 600))
      return Response.json({ ok: false, message: "Too many calls for now. Try again in an hour." }, { status: 429 });

    if ((request.headers.get("content-type") ?? "").includes("multipart/form-data")) {
      const entry = (await request.formData().catch(() => null))?.get("file");
      const file = entry instanceof File ? entry : null;
      if (!file) return Response.json({ ok: false, message: "Choose a sheet to upload." }, { status: 400 });
      if (file.size > IMPORT_LIMITS.fileBytes)
        return Response.json({ ok: false, message: "That file is over 4 MB. Save it as CSV and upload that." }, { status: 413 });
      try {
        const rows = readXlsxRows(Buffer.from(await file.arrayBuffer()))
          .map((r) => r.slice(0, IMPORT_LIMITS.columns).map((c) => (c ?? "").toString().trim().slice(0, IMPORT_LIMITS.cell)))
          .filter((r) => r.some(Boolean))
          .slice(0, IMPORT_LIMITS.rows + 1);
        if (rows.length < 2) return Response.json({ ok: false, message: "We couldn't find any rows in that file." }, { status: 422 });
        return Response.json({ ok: true, rows });
      } catch {
        return Response.json({ ok: false, message: "That file couldn't be read. Upload an Excel (.xlsx) or CSV sheet." }, { status: 422 });
      }
    }

    const body = (await request.json().catch(() => null)) as { rows?: unknown; mode?: unknown; sheet?: unknown } | null;
    const rows = (Array.isArray(body?.rows) ? body.rows : [])
      .slice(0, IMPORT_LIMITS.batch)
      .map(cleanImportRow)
      .filter((r): r is ImportRow => Boolean(r));
    if (!rows.length) return Response.json({ ok: false, message: "Nothing to bring in." }, { status: 400 });
    const sheet =
      typeof body?.sheet === "string"
        ? body.sheet
            .replace(/[\u0000-\u001f<>]/g, "")
            .trim()
            .slice(0, 80)
        : "";
    const results = await bringInSheetRows(who.member.businessId, rows, cleanImportMode(body?.mode), sheet, who.member.email);
    return Response.json({ ok: true, results });
  });
}
