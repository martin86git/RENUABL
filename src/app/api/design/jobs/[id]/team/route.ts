import { after } from "next/server";
import { asksSolOnDeal, cleanDealWords, isDealLineId } from "@/lib/domain/design/deal-team";
import { parseApiKey } from "@/lib/server/bill-reader";
import { normaliseMobile } from "@/lib/domain/contact";
import { can } from "@/lib/domain/design/account";
import { localMobile, textSignOff } from "@/lib/domain/design/texts";
import { answer, readBody, requireMember, viewerOf } from "@/lib/server/design-context";
import { jobById } from "@/lib/server/design-crm-repo";
import { textsOnFor, textsStopped } from "@/lib/server/design-texts";
import {
  DealTeamRefusal,
  dealAsk,
  dealTeam,
  followDeal,
  markAskDone,
  markDealSeen,
  openDealChat,
  sayOnDeal,
  type DealTeamMe,
} from "@/lib/server/design-deal-team-repo";
import { solAnswersOnDeal } from "@/lib/server/design-sol";
import type { Member } from "@/lib/server/design-repo";
import { allow } from "@/lib/server/rate-limit";

// Sol, tagged on a deal, answers after the line is in: his tools can take a minute.
export const maxDuration = 180;

const validId = (id: string) => /^job_[a-f0-9]{8,64}$/.test(id);
const meOf = (m: Member): DealTeamMe => ({ businessId: m.businessId, email: m.email, viewer: viewerOf(m) });
const gone = () => Response.json({ ok: false, message: "That deal isn't here." }, { status: 404 });

/**
 * The team chat on a deal (deal-team.ts): the business's own people and Sol, never the customer, for everyone who may
 * see the deal. GET → its lines and the people to @mention; GET ?ask=<line> → one of Sol's requests (the designer's
 * brief). POST { text } says something (an "@Sol" in it has him answer there); POST { follow } follows it or stops,
 * { open: true } opens it from the team chat window (following it), { seen: true } reads it; POST { done: <line>, undo? } marks a
 * request done or opens it again.
 */
export async function GET(request: Request, ctx: RouteContext<"/api/design/jobs/[id]/team">) {
  return answer(async () => {
    const { id } = await ctx.params;
    const who = await requireMember("design");
    if ("refuse" in who) return who.refuse;
    if (!validId(id)) return gone();
    const askId = new URL(request.url).searchParams.get("ask");
    try {
      if (askId) {
        if (!isDealLineId(askId)) return Response.json({ ok: false, message: "That request isn't here." }, { status: 404 });
        const line = await dealAsk(meOf(who.member), id, askId);
        return line
          ? Response.json({ ok: true, line })
          : Response.json({ ok: false, message: "That request isn't here." }, { status: 404 });
      }
      const seen = new URL(request.url).searchParams.get("seen") === "1";
      const m = who.member;
      const view = await dealTeam(meOf(m), id, { seen });
      // Texting the customer from this chat: where texts are on, they have a mobile, and this member may publish.
      let texting: { to: string; stopped: boolean; signOff: string } | null = null;
      if (can(m.role, "publish", m.permissions) && (await textsOnFor(m.businessId))) {
        const found = await jobById(m.businessId, id, viewerOf(m));
        const mobile = found ? normaliseMobile(found.customer.phone) : null;
        if (found && mobile)
          texting = {
            to: localMobile(mobile),
            stopped: await textsStopped(m.businessId, found.customer.id),
            signOff: textSignOff(m.firstName, m.businessName),
          };
      }
      return Response.json({ ok: true, ...view, texting, me: m.email.toLowerCase() });
    } catch (e) {
      if (e instanceof DealTeamRefusal) return gone();
      throw e;
    }
  });
}

export async function POST(request: Request, ctx: RouteContext<"/api/design/jobs/[id]/team">) {
  return answer(async () => {
    const { id } = await ctx.params;
    const who = await requireMember("design");
    if ("refuse" in who) return who.refuse;
    if (!validId(id)) return gone();
    const read = await readBody(request, 8_000);
    if ("refuse" in read) return read.refuse;
    const b = read.body;
    const me = meOf(who.member);
    try {
      if (typeof b.follow === "boolean") return Response.json({ ok: true, following: await followDeal(me, id, b.follow) });
      if (b.open === true) {
        await openDealChat(me, id);
        return Response.json({ ok: true });
      }
      if (b.seen === true) {
        await markDealSeen(me, id);
        return Response.json({ ok: true });
      }
      if (isDealLineId(b.done)) {
        const changed = await markAskDone(me, id, b.done, b.undo !== true);
        return changed
          ? Response.json({ ok: true })
          : Response.json({ ok: false, message: "Someone has already changed that request." }, { status: 409 });
      }
      if (!allow(request, "design-deal-team", 600))
        return Response.json({ ok: false, message: "That's a lot of messages this hour: try again shortly." }, { status: 429 });
      const text = cleanDealWords(b.text);
      const said = await sayOnDeal(me, id, text);
      const asking = asksSolOnDeal(text);
      if (asking) {
        const apiKey = parseApiKey(process.env.ANTHROPIC_API_KEY);
        after(() =>
          solAnswersOnDeal(who.member, id, text, apiKey).catch((e) => console.error("sol on a deal", e instanceof Error ? e.message : e)),
        );
      }
      return Response.json({ ok: true, ...said, solAnswering: asking });
    } catch (e) {
      if (e instanceof DealTeamRefusal)
        return e.message === "That deal isn't here." ? gone() : Response.json({ ok: false, message: e.message }, { status: 422 });
      throw e;
    }
  });
}
