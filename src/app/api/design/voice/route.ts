import { answer, requireMember } from "@/lib/server/design-context";
import { mayCallFromBrowser } from "@/lib/server/browser-calls";
import { allow } from "@/lib/server/rate-limit";
import { accessToken, browserCallSettings, identityFor } from "@/lib/server/twilio-voice";

const PRIVATE = { "cache-control": "private, no-store" };

/**
 * GET: whether this member may call from the computer, and if so Twilio's token for the browser (an hour; it may only
 * make calls through our TwiML app, and receives none). The member's Twilio identity tells Twilio nothing about them.
 */
export async function GET(request: Request) {
  return answer(async () => {
    const who = await requireMember("design");
    if ("refuse" in who) return who.refuse;
    const s = browserCallSettings();
    if (!s || !(await mayCallFromBrowser(who.member.businessId))) return Response.json({ ok: true, on: false }, { headers: PRIVATE });
    if (!allow(request, "design-voice-token", 60))
      return Response.json({ ok: false, message: "Try again in a little while." }, { status: 429, headers: PRIVATE });
    const identity = identityFor(who.member.businessId, who.member.email);
    return Response.json({ ok: true, on: true, token: accessToken(s, identity) }, { headers: PRIVATE });
  });
}
