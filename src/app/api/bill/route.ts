import { BILL_PROBLEM_MESSAGES, BILL_UPLOAD, isBillMediaType, isBillSummary, summariseBill } from "@/lib/domain/bill";
import { PREVIEW_MODE } from "@/lib/config";
import { SAMPLE_READING, parseApiKey, readBillWithClaude, redactSecrets } from "@/lib/server/bill-reader";

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

  const apiKey = parseApiKey(process.env.ANTHROPIC_API_KEY);
  if (process.env.ANTHROPIC_API_KEY && !apiKey) {
    console.error("bill read failed: ANTHROPIC_API_KEY is set but contains no API key");
    const message = "We can't read bills right now. Please try again shortly.";
    return fail(PREVIEW_MODE ? `${message} (Preview detail: ANTHROPIC_API_KEY doesn't contain a valid key.)` : message, 503);
  }
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
    // Never let a key reach logs or the screen.
    const detail = redactSecrets(e instanceof Error ? e.message : String(e));
    console.error("bill read failed", detail);
    // While in preview, show the reason on screen so it can be fixed without digging through logs.
    const message = "We couldn't read that bill just now. Please try again.";
    return fail(PREVIEW_MODE ? `${message} (Preview detail: ${detail.slice(0, 300)})` : message, 502);
  }
}
