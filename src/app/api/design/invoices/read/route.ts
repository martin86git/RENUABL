import { cleanInvoiceFigures } from "@/lib/domain/design/installer-invoices";
import { parseApiKey, redactSecrets } from "@/lib/server/bill-reader";
import { answer, requireMember } from "@/lib/server/design-context";
import { INVOICE_TYPES, MAX_INVOICE_BYTES, readInvoiceWithClaude, type InvoiceType } from "@/lib/server/invoice-reader";
import { allow } from "@/lib/server/rate-limit";

export const maxDuration = 60;

const fail = (message: string, status: number) => Response.json({ ok: false, message }, { status });

/**
 * POST multipart "file": reads an installer's invoice (PDF or photo) and
 * answers with its figures for the business to check. Nothing is kept: the
 * file is read and let go, and the figures are saved only when the business
 * confirms them.
 */
export async function POST(request: Request) {
  return answer(async () => {
    const who = await requireMember("costs");
    if ("refuse" in who) return who.refuse;
    if (!allow(request, "design-invoice-read", 60)) return fail("That's a lot of invoices at once. Try again in a minute.", 429);
    let file: File | null = null;
    try {
      const got = (await request.formData()).get("file");
      file = got instanceof File && got.size > 0 ? got : null;
    } catch {
      file = null;
    }
    if (!file) return fail("Choose the installer's invoice to read.", 400);
    if (!(INVOICE_TYPES as readonly string[]).includes(file.type))
      return fail("Use a PDF, or a JPG, PNG or WebP photo of the invoice.", 415);
    if (file.size > MAX_INVOICE_BYTES) return fail("That file is too large. Try one under 8 MB.", 413);
    const apiKey = parseApiKey(process.env.ANTHROPIC_API_KEY);
    if (!apiKey) return fail("Invoices can't be read on this site yet. Type its figures in instead.", 503);
    try {
      const reading = await readInvoiceWithClaude({ data: await file.arrayBuffer(), mediaType: file.type as InvoiceType }, apiKey);
      if (!reading.isInvoice) return fail("That doesn't look like an invoice. Check the file, or type its figures in.", 422);
      const figures = cleanInvoiceFigures(reading);
      return Response.json({
        ok: true,
        figures: figures ?? { installer: reading.installer ?? "", number: reading.number ?? "", date: "", subTotal: 0, gst: 0, lines: [] },
        reference: reading.reference ?? "",
        complete: Boolean(figures),
      });
    } catch (e) {
      console.error("invoice read failed", redactSecrets(e instanceof Error ? e.message : String(e)));
      return fail("That invoice couldn't be read just now. Try again, or type its figures in.", 502);
    }
  });
}
