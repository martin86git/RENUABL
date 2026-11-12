import { dialTwiml, sayTwiml } from "@/lib/domain/browser-call";
import { takeTicket } from "@/lib/server/browser-calls";
import { browserCallSettings, fromTwilio } from "@/lib/server/twilio-voice";

const twiml = (body: string) => new Response(body, { headers: { "content-type": "text/xml; charset=utf-8" } });

/**
 * POST: Twilio asking what to do with a call the browser started (the TwiML app's Voice URL). Checked by Twilio's
 * signature; the ticket must be the one made for this member's identity, fresh and unused. Then: ring the customer's
 * number from ours, tell them the call may be recorded, and record both sides.
 */
export async function POST(request: Request) {
  const s = browserCallSettings();
  if (!s) return new Response("Not set up", { status: 404 });
  const p = await fromTwilio(request, s);
  if (!p) return new Response("Forbidden", { status: 403 });
  const identity = (p.From ?? "").replace(/^client:/, "");
  const row = await takeTicket(p.ticket ?? "", identity, p.CallSid ?? "").catch(() => null);
  if (!row) return twiml(sayTwiml("This call can't be made. Please try again from the deal."));
  const at = (path: string) => `${s.site}/api/voice/twilio/${path}?call=${row.id}`;
  return twiml(
    dialTwiml({
      callerId: s.callerId,
      number: row.number,
      actionUrl: at("done"),
      noticeUrl: s.record ? at("notice") : null,
      recordingUrl: s.record ? at("recording") : null,
    }),
  );
}
