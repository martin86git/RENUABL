import { BILL_PROBLEM_MESSAGES, BILL_UPLOAD, isBillMediaType, isBillSummary, summariseBill } from "@/lib/domain/bill";
import { PREVIEW_MODE } from "@/lib/config";
import { BillReaderError, SAMPLE_READING, readBillWithClaude } from "@/lib/server/bill-reader";

export const maxDuration = 60;

function fail(message: string, status: number) {
  return Response.json({ ok: false, message }, { status });
}

/** POST a bill (multipart field "bill"); returns the usage summary the recommendation is sized from. */
export async function POST(request: Request) {
  let file: FormDataEntryValue | null;
  try {
    file = (await request.formData()).get("bill");
  } catch {
    return fail("Please upload your bill as a PDF or photo.", 400);
  }
  if (!(file instanceof File) || file.size === 0) return fail("Please upload your bill as a PDF or photo.", 400);
  if (!isBillMediaType(file.type)) return fail("Please upload a PDF, JPG, PNG or WebP.", 415);
  if (file.size > BILL_UPLOAD.maxBytes) return fail("That file is too large. Try the PDF from your retailer's email, or a photo.", 413);

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    if (!PREVIEW_MODE) return fail("We can't read bills right now. Please try again shortly.", 503);
    const sample = summariseBill(SAMPLE_READING);
    return Response.json({ ok: true, bill: isBillSummary(sample) ? { ...sample, sample: true } : null });
  }

  try {
    const summary = summariseBill(await readBillWithClaude(await file.arrayBuffer(), file.type, apiKey));
    if (!isBillSummary(summary)) return fail(BILL_PROBLEM_MESSAGES[summary], 422);
    return Response.json({ ok: true, bill: summary });
  } catch (e) {
    console.error("bill read failed", e instanceof BillReaderError ? e.message : e);
    return fail("We couldn't read that bill just now. Please try again.", 502);
  }
}
