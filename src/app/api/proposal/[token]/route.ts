import { after } from "next/server";
import { todayInMarket } from "@/lib/domain/market";
import { cleanAcceptance, cleanQuestion } from "@/lib/domain/design/proposal";
import { answer, readBody } from "@/lib/server/design-context";
import { acceptProposal, askQuestion, markOpened, publicProposal } from "@/lib/server/design-proposal-repo";
import { tellAccepted } from "@/lib/server/design-notify";
import { allow } from "@/lib/server/rate-limit";

/** A link we never made and one that doesn't exist answer the same. */
const notFound = () => Response.json({ ok: false, message: "This proposal isn't available." }, { status: 404 });
const slowDown = () => Response.json({ ok: false, message: "Try again in a little while." }, { status: 429 });
const PRIVATE = { "cache-control": "private, no-store", "x-robots-tag": "noindex, nofollow", "referrer-policy": "no-referrer" };

/**
 * GET: the proposal behind a private link, for the customer it was sent to.
 * No sign-in: the link is the key. Only the customer's copy is ever sent:
 * the system, the price they pay, the rebate, the estimates and the
 * business's branding. Once withdrawn, only who to contact.
 */
export async function GET(request: Request, ctx: RouteContext<"/api/proposal/[token]">) {
  return answer(async () => {
    const { token } = await ctx.params;
    if (!allow(request, "proposal", 240)) return slowDown();
    const found = await publicProposal(token, todayInMarket());
    return found ? Response.json({ ok: true, ...found }, { headers: PRIVATE }) : notFound();
  });
}

/**
 * POST { action: "opened" } | { action: "accept", name, agree: true } |
 * { action: "question", text }: what a customer can do from their proposal.
 * Opening is written on their record once. Going ahead is kept once, with
 * the name typed and the server's time, and only while the proposal is live
 * (not lapsed, withdrawn or already accepted). A question goes on their
 * record for the business to answer.
 */
export async function POST(request: Request, ctx: RouteContext<"/api/proposal/[token]">) {
  return answer(async () => {
    const { token } = await ctx.params;
    const read = await readBody(request, 5_000);
    if ("refuse" in read) return read.refuse;
    const today = todayInMarket();

    if (read.body.action === "opened") {
      if (allow(request, "proposal-opened", 60)) await markOpened(token);
      return Response.json({ ok: true }, { headers: PRIVATE });
    }
    if (read.body.action === "accept") {
      if (!allow(request, "proposal-accept", 20)) return slowDown();
      const input = cleanAcceptance(read.body);
      if (!input.ok) return Response.json({ ok: false, message: input.message }, { status: 422 });
      const result = await acceptProposal(token, input.value.name, today);
      if (!result) return notFound();
      // Told once, when it is first accepted, and not waited for: an email that can't be sent never holds the customer up.
      if (result === "accepted-now") after(() => tellAccepted(token));
      if (result !== "accepted-now" && result !== "accepted" && result !== "live") {
        const why = {
          lapsed: "This price has lapsed. Ask for an up-to-date proposal.",
          withdrawn: "This proposal isn't available any more.",
        }[result];
        return Response.json({ ok: false, message: why }, { status: 409 });
      }
      const found = await publicProposal(token, today);
      return Response.json({ ok: true, ...found }, { headers: PRIVATE });
    }
    if (read.body.action === "question") {
      if (!allow(request, "proposal-question", 10)) return slowDown();
      const input = cleanQuestion(read.body);
      if (!input.ok) return Response.json({ ok: false, message: input.message }, { status: 422 });
      const result = await askQuestion(token, input.value.text);
      if (!result) return notFound();
      if (result === "full")
        return Response.json({ ok: false, message: "That's a lot of questions. It's quicker to call or email us now." }, { status: 429 });
      return Response.json({ ok: true }, { headers: PRIVATE });
    }
    return Response.json({ ok: false, message: "That can't be done here." }, { status: 400 });
  });
}
