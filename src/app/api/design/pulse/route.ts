import { answer, requireMember, viewerOf } from "@/lib/server/design-context";
import { dealPulses } from "@/lib/server/design-pulse-repo";

/** GET → { pulses }: the clock and temperature of every deal this member may see that is still being sold, ranked. */
export async function GET() {
  return answer(async () => {
    const who = await requireMember("design");
    if ("refuse" in who) return who.refuse;
    return Response.json({ ok: true, pulses: await dealPulses(who.member.businessId, viewerOf(who.member)) });
  });
}
