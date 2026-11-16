import { after } from "next/server";
import { siteUrl } from "@/lib/domain/sms";
import { receiveText } from "@/lib/server/design-texts";
import { allow } from "@/lib/server/rate-limit";
import { signedByTwilio } from "@/lib/server/twilio-voice";

const EMPTY = '<?xml version="1.0" encoding="UTF-8"?><Response/>';
const twiml = (status = 200) => new Response(EMPTY, { status, headers: { "content-type": "text/xml; charset=utf-8" } });

/**
 * Twilio calls this when a text comes in to the number texts are sent from (the number's "A message comes in" address:
 * `<site>/api/voice/twilio/sms`, POST). Only a request Twilio signed is taken (its signature over the address it was
 * told, built from SITE_URL, and the form's fields, with the account's auth token). The text is kept on the deal of
 * the customer whose mobile it came from, in the business whose number it was sent to (domain/design/texts.ts). Nothing is texted back: the answer is empty.
 */
export async function POST(request: Request) {
  const token = process.env.TWILIO_AUTH_TOKEN?.trim();
  const site = siteUrl();
  if (!token || !site) return twiml(503);
  if (!allow(request, "twilio-sms-in", 600)) return twiml(429);
  const form = await request.formData().catch(() => null);
  if (!form) return twiml(400);
  const params: Record<string, string> = {};
  for (const [k, v] of form.entries()) if (typeof v === "string") params[k] = v;
  const url = new URL(request.url);
  if (!signedByTwilio(token, `${site}${url.pathname}${url.search}`, params, request.headers.get("x-twilio-signature"))) return twiml(403);
  const from = params.From ?? "";
  const body = params.Body ?? "";
  // Twilio is answered at once; the text is kept after.
  after(() =>
    receiveText(from, body, params.To).catch((e) =>
      console.error("a text that came in couldn't be kept", e instanceof Error ? e.message : e),
    ),
  );
  return twiml();
}
