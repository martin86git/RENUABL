import { INVERTER_PHOTOS, INVERTER_PROBLEM_MESSAGES, isInverterSummary, summariseInverter } from "@/lib/domain/inverter";
import { PREVIEW_MODE } from "@/lib/config";
import { parseApiKey, redactSecrets } from "@/lib/server/bill-reader";
import { SAMPLE_INVERTER, readInverterWithClaude } from "@/lib/server/inverter-reader";

export const maxDuration = 60;

const TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
type PhotoType = (typeof TYPES)[number];

function fail(message: string, status: number) {
  return Response.json({ ok: false, message }, { status });
}

/** POST photos (multipart field "photos", up to 3) of an existing inverter; returns its make, model and size. Photos aren't stored. */
export async function POST(request: Request) {
  let photos: File[];
  try {
    photos = (await request.formData()).getAll("photos").filter((f): f is File => f instanceof File && f.size > 0);
  } catch {
    return fail("Please add a photo of your inverter.", 400);
  }
  if (photos.length === 0) return fail("Please add a photo of your inverter.", 400);
  if (photos.length > INVERTER_PHOTOS.max) return fail(`Please add up to ${INVERTER_PHOTOS.max} photos.`, 400);
  if (photos.some((p) => !(TYPES as readonly string[]).includes(p.type))) return fail("Please use JPG, PNG or WebP photos.", 415);
  if (photos.reduce((s, p) => s + p.size, 0) > INVERTER_PHOTOS.maxTotalBytes)
    return fail("Those photos are too large. Try again with smaller photos.", 413);

  const apiKey = parseApiKey(process.env.ANTHROPIC_API_KEY);
  if (!apiKey) {
    if (!PREVIEW_MODE) return fail("We can't read photos right now. We'll check your inverter on your call.", 503);
    const sample = summariseInverter(SAMPLE_INVERTER);
    return Response.json({ ok: true, inverter: isInverterSummary(sample) ? { ...sample, sample: true } : null });
  }
  try {
    const reading = await readInverterWithClaude(
      await Promise.all(photos.map(async (p) => ({ data: await p.arrayBuffer(), mediaType: p.type as PhotoType }))),
      apiKey,
    );
    const summary = summariseInverter(reading);
    if (!isInverterSummary(summary)) return fail(INVERTER_PROBLEM_MESSAGES[summary], 422);
    return Response.json({ ok: true, inverter: summary });
  } catch (e) {
    const detail = redactSecrets(e instanceof Error ? e.message : String(e));
    console.error("inverter read failed", detail);
    const message = "We couldn't read those photos just now. No problem, we'll check your inverter on your call.";
    return fail(PREVIEW_MODE ? `${message} (Preview detail: ${detail.slice(0, 200)})` : message, 502);
  }
}
