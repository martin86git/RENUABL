import { answer, requireMember, viewerOf } from "@/lib/server/design-context";
import { callLog } from "@/lib/server/design-call-log-repo";
import { cleanCallerKey } from "@/lib/domain/install-call";

/**
 * GET → { calls, coming, solOn }: the call log, for the deals this member may see. `?role=<agent key>` narrows it to
 * one voice agent's calls (its window's Calls view).
 */
export async function GET(request: Request) {
  return answer(async () => {
    const who = await requireMember("design");
    if ("refuse" in who) return who.refuse;
    const asked = new URL(request.url).searchParams.get("role");
    const role = asked ? cleanCallerKey(asked) : undefined;
    return Response.json({ ok: true, ...(await callLog(who.member.businessId, viewerOf(who.member), role)) });
  });
}
