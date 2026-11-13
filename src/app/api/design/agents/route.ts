import { can } from "@/lib/domain/design/account";
import { AGENT_COPY, cleanAgentKind, needsNewNumber, numberRequestNote } from "@/lib/domain/design/agents";
import { isStaff } from "@/lib/server/accounts";
import { agentsOf } from "@/lib/server/design-agents";
import { answer, readBody, requireMember } from "@/lib/server/design-context";
import { tellStaff } from "@/lib/server/design-staff-note";
import { staffBehind } from "@/lib/server/design-staff-view";
import { allow } from "@/lib/server/rate-limit";

/**
 * GET → the business's agents (the two phone assistants and the chief of staff): which it has made, and what is set up
 * for each, yes or no only. `mayChange` says whether this member may add one; `staff` lets RENUABL's own people see
 * which settings a missing need is.
 */
export async function GET() {
  return answer(async () => {
    const who = await requireMember("design");
    if ("refuse" in who) return who.refuse;
    const { businessId, role, permissions, email } = who.member;
    const [found, behind] = await Promise.all([agentsOf(businessId), staffBehind().catch(() => null)]);
    return Response.json(
      { ok: true, ...found, mayChange: can(role, "prices", permissions), staff: isStaff(email) || Boolean(behind) },
      { headers: { "cache-control": "private, no-store" } },
    );
  });
}

/**
 * POST { kind } → asks RENUABL for a phone number for that kind of agent: RENUABL's staff are emailed who asked and
 * why. Only for a member who may change settings, and only while that agent really is short of a number.
 */
export async function POST(request: Request) {
  return answer(async () => {
    const who = await requireMember("prices");
    if ("refuse" in who) return who.refuse;
    if (!allow(request, "design-agent-number", 6))
      return Response.json({ ok: false, message: "You've asked a few times already. We'll be in touch." }, { status: 429 });
    const read = await readBody(request, 1_000);
    if ("refuse" in read) return read.refuse;
    const kind = cleanAgentKind(read.body.kind);
    if (!kind) return Response.json({ ok: false, message: "Pick the agent the number is for." }, { status: 422 });
    const { status, agents } = await agentsOf(who.member.businessId);
    if (!needsNewNumber(kind, status))
      return Response.json({ ok: false, message: "That agent already has the number it needs." }, { status: 409 });
    const sent = await tellStaff(
      numberRequestNote({
        business: who.member.businessName,
        by: who.member.email,
        kind,
        agentName: agents.find((a) => a.kind === kind)?.name ?? null,
      }),
    );
    if (!sent) return Response.json({ ok: false, message: AGENT_COPY.askFailed }, { status: 502 });
    return Response.json({ ok: true, message: AGENT_COPY.asked });
  });
}
