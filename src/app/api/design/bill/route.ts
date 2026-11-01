import {
  BILL_PROBLEM_MESSAGES,
  BILL_UPLOAD,
  addressForBillCheck,
  addressMismatchMessage,
  billAddressMismatch,
  isBillMediaType,
  isBillSummary,
  summariseBill,
} from "@/lib/domain/bill";
import { parseApiKey, readBillWithClaude, redactSecrets } from "@/lib/server/bill-reader";
import { answer, requireMember } from "@/lib/server/design-context";
import { allow } from "@/lib/server/rate-limit";

export const maxDuration = 60;

const fail = (message: string, status: number) => Response.json({ ok: false, message }, { status });

/**
 * POST a bill photo or PDF (multipart "bill", with the roof's "address") from the roof designer → its usage, period
 * and rates (2 Nov 2026, Martin): the homeowner site's own reader (`readBillWithClaude`, `summariseBill`), never the
 * customer's personal details, and the file isn't kept. A bill clearly for another address is turned away. The
 * designer puts the figures in its bill box to check (`billFieldsFromPhoto`).
 */
export async function POST(request: Request) {
  return answer(async () => {
    const who = await requireMember("design");
    if ("refuse" in who) return who.refuse;
    let file: FormDataEntryValue | null;
    let address: string | null;
    try {
      const form = await request.formData();
      file = form.get("bill");
      address = addressForBillCheck(form.get("address"));
    } catch {
      return fail("Send the bill as a PDF or photo.", 400);
    }
    if (!(file instanceof File) || file.size === 0) return fail("Send the bill as a PDF or photo.", 400);
    if (!isBillMediaType(file.type)) return fail("A PDF, JPG, PNG or WebP, please.", 415);
    if (file.size > BILL_UPLOAD.maxBytes) return fail("That file is too large: the PDF from the retailer's email, or a photo.", 413);
    if (!allow(request, "design-bill", 60)) return fail("A lot of bills read in the last hour. Try again shortly.", 429);
    const apiKey = parseApiKey(process.env.ANTHROPIC_API_KEY);
    if (!apiKey) return fail("Bills can't be read here: Claude isn't set up. Type the figures in.", 503);
    try {
      const reading = await readBillWithClaude(await file.arrayBuffer(), file.type, apiKey, address);
      if (address && billAddressMismatch(reading.supplyAddressMatches)) return fail(addressMismatchMessage(address), 422);
      const { supplyAddressMatches: _match, ...figures } = reading;
      void _match;
      const summary = summariseBill(figures);
      if (!isBillSummary(summary)) return fail(BILL_PROBLEM_MESSAGES[summary], 422);
      return Response.json({
        ok: true,
        read: {
          periodDays: summary.periodDays,
          dailyUsageKwh: summary.dailyUsageKwh,
          usageRate: summary.usageRate,
          feedInRate: summary.feedInRate,
          exportedDailyKwh: summary.exportedDailyKwh,
        },
      });
    } catch (e) {
      console.error("designer bill read failed", redactSecrets(e instanceof Error ? e.message : String(e)));
      return fail("That bill couldn't be read just now. Try again, or type the figures in.", 502);
    }
  });
}
