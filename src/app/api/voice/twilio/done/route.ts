import { EMPTY_TWIML } from "@/lib/domain/browser-call";
import { callEnded } from "@/lib/server/browser-calls";
import { browserCallSettings, fromTwilio } from "@/lib/server/twilio-voice";

/**
 * POST: Twilio saying how a call from the computer ended (the Dial's action): kept, and written on the deal when it
 * isn't waiting for a recording.
 */
export async function POST(request: Request) {
  const s = browserCallSettings();
  if (!s) return new Response("Not set up", { status: 404 });
  const p = await fromTwilio(request, s);
  if (!p) return new Response("Forbidden", { status: 403 });
  const id = new URL(request.url).searchParams.get("call") ?? "";
  await callEnded(id, p.DialCallStatus ?? "", Number(p.DialCallDuration ?? 0) || 0).catch((e) =>
    console.error("browser call end not kept", e instanceof Error ? e.message : e),
  );
  return new Response(EMPTY_TWIML, { headers: { "content-type": "text/xml; charset=utf-8" } });
}
