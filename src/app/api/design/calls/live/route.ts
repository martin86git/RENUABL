import { answer, requireMember, viewerOf } from "@/lib/server/design-context";
import { liveCallsNow } from "@/lib/server/design-call-log-repo";
import { voiceOnFor } from "@/lib/server/voice-calls";

/**
 * GET → { on, calls }: every call of the phone assistant's ringing or on right now, on the deals this member may see.
 * Asked every few seconds by the tray on every page; `on` false (calls aren't switched on for the business) tells it to
 * stop asking.
 */
export async function GET() {
  return answer(async () => {
    const who = await requireMember("design");
    if ("refuse" in who) return who.refuse;
    const on = await voiceOnFor(who.member.businessId);
    const calls = on ? await liveCallsNow(who.member.businessId, viewerOf(who.member)) : [];
    return Response.json({ ok: true, on, calls }, { headers: { "cache-control": "private, no-store" } });
  });
}
