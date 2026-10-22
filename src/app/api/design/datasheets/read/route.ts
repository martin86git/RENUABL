import { formFromReading } from "@/lib/domain/design/datasheets";
import { parseApiKey, redactSecrets } from "@/lib/server/bill-reader";
import { MAX_SHEET_BYTES, SHEET_TYPES, readDatasheetWithClaude, type SheetType } from "@/lib/server/datasheet-reader";
import { answer, requireMember } from "@/lib/server/design-context";
import { allow } from "@/lib/server/rate-limit";

export const maxDuration = 60;

const fail = (message: string, status: number) => Response.json({ ok: false, message }, { status });

/**
 * POST multipart "file": reads a panel's or inverter's datasheet and answers with its figures as a form for the
 * business to check. Nothing is kept: the file is read and let go, and the figures are saved only when checked.
 */
export async function POST(request: Request) {
  return answer(async () => {
    const who = await requireMember("prices");
    if ("refuse" in who) return who.refuse;
    if (!allow(request, "design-datasheet-read", 40)) return fail("That's a lot of datasheets at once. Try again in a minute.", 429);
    let file: File | null = null;
    try {
      const got = (await request.formData()).get("file");
      file = got instanceof File && got.size > 0 ? got : null;
    } catch {
      file = null;
    }
    if (!file) return fail("Choose the datasheet to read.", 400);
    if (!(SHEET_TYPES as readonly string[]).includes(file.type))
      return fail("Use a PDF, or a JPG, PNG or WebP picture of the datasheet.", 415);
    if (file.size > MAX_SHEET_BYTES) return fail("That file is too large. Try one under 10 MB.", 413);
    const apiKey = parseApiKey(process.env.ANTHROPIC_API_KEY);
    if (!apiKey) return fail("Datasheets can't be read on this site yet. Type the figures in instead.", 503);
    try {
      const reading = await readDatasheetWithClaude({ data: await file.arrayBuffer(), mediaType: file.type as SheetType }, apiKey);
      if (!reading.isDatasheet)
        return fail("That doesn't look like a panel or inverter datasheet. Check the file, or type the figures in.", 422);
      return Response.json({ ok: true, form: formFromReading(reading), fileName: file.name.slice(0, 120) });
    } catch (e) {
      console.error("datasheet read failed", redactSecrets(e instanceof Error ? e.message : String(e)));
      return fail("That datasheet couldn't be read just now. Try again, or type the figures in.", 502);
    }
  });
}
