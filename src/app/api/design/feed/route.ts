import { after } from "next/server";
import { answer, requireMember, viewerOf } from "@/lib/server/design-context";
import { fireDue } from "@/lib/server/design-sol-agents";
import { solAsksForDesigns } from "@/lib/server/design-deal-team-repo";
import { dayDone, dealFeed, exampleCount, feedExtras, markDeal, unmarkDeal } from "@/lib/server/design-feed";
import type { LaterChoice, MarkKind } from "@/lib/domain/design/deal-feed";

/**
 * GET → { deals, callsOn, team }: the deal feed on Today (deal-feed.ts), every deal this member may see that is being
 * sold or heading to install, whether Sol may ring customers, and the others in the business to bring in.
 */
export async function GET() {
  return answer(async () => {
    const who = await requireMember("design");
    if ("refuse" in who) return who.refuse;
    // Sol looks over the deals not yet designed whose customers have said what they want, and asks for a design in
    // the deal's team chat (at most every few minutes a business; by rule, no credit).
    await solAsksForDesigns(who.member.businessId).catch((e) => console.error("sol's design requests", e instanceof Error ? e.message : e));
    const [deals, extras, examples, today] = await Promise.all([
      dealFeed(who.member, viewerOf(who.member)),
      feedExtras(who.member.businessId, who.member.email),
      exampleCount(who.member.businessId).catch(() => null),
      dayDone(who.member.businessId, who.member.email).catch(() => null),
    ]);
    // What has come due in Sol's outbox goes after the answer, as when the board is read (not while viewing as someone).
    if (!who.member.viewedBy) {
      const business = { id: who.member.businessId, name: who.member.businessName };
      after(() => fireDue(business).catch((e) => console.error("Sol's outbox couldn't send", e instanceof Error ? e.message : e)));
    }
    return Response.json({ ok: true, deals, ...extras, examples, today });
  });
}

const KINDS: readonly MarkKind[] = ["done", "later"];
const LATER: readonly LaterChoice[] = ["tomorrow", "week", "reply"];

/**
 * POST { jobId, do: "done" | "later" | "undo", later?, need? } → { mark }: Done or Later on a deal's card, or taken off
 * again (docs/plans/needs-you-sign-offs.md). Only a deal this member may see; written on its record.
 */
export async function POST(request: Request) {
  return answer(async () => {
    const who = await requireMember("design");
    if ("refuse" in who) return who.refuse;
    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
    const jobId = typeof body?.jobId === "string" ? body.jobId : "";
    const act = body?.do;
    if (!jobId) return Response.json({ ok: false, message: "Which deal?" }, { status: 400 });
    if (act === "undo") {
      const ok = await unmarkDeal(who.member, viewerOf(who.member), jobId);
      return ok ? Response.json({ ok: true, mark: null }) : Response.json({ ok: false, message: "That deal isn't here." }, { status: 404 });
    }
    if (!KINDS.includes(act as MarkKind)) return Response.json({ ok: false, message: "Done or Later?" }, { status: 400 });
    const later = LATER.includes(body?.later as LaterChoice) ? (body?.later as LaterChoice) : "tomorrow";
    const need = typeof body?.need === "string" ? body.need : "";
    const mark = await markDeal(who.member, viewerOf(who.member), jobId, { kind: act as MarkKind, later, need });
    if (mark === "missing") return Response.json({ ok: false, message: "That deal isn't here." }, { status: 404 });
    return Response.json({ ok: true, mark });
  });
}
