import { after } from "next/server";
import { todayInMarket } from "@/lib/domain/market";
import { NO_DEPOSIT, NOT_ACCEPTED, PAID_WAY_WRONG, PAID_WAYS, type PaidWay } from "@/lib/domain/design/deposit";
import { cleanAcceptance } from "@/lib/domain/design/proposal";
import { answer, readBody } from "@/lib/server/design-context";
import { acceptProposal, markOpened, proposalJob, publicProposal, sayPaid } from "@/lib/server/design-proposal-repo";
import { afterSigning } from "@/lib/server/design-after-sale-repo";
import { tellAccepted, tellPaid } from "@/lib/server/design-notify";
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
 * { action: "paid", way: "bank" | "card" }: what a customer can do from
 * their proposal (writing to the business is its own route, /chat).
 * Opening is written on their record once. Going ahead is kept once, with
 * the name typed and the server's time, and only while the proposal is live
 * (not lapsed, withdrawn or already accepted). "Paid" is the customer saying
 * they have paid the deposit: kept as what they said, once, only on an
 * accepted proposal that asks for a deposit; it is never a payment (none
 * passes through here) and never marks the deposit received.
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
      // The system chosen, when the proposal offers a choice: checked against what it offers beside the proposal itself.
      const option = typeof read.body.option === "string" ? read.body.option.slice(0, 20) : null;
      const result = await acceptProposal(token, input.value.name, today, option);
      if (!result) return notFound();
      // Told once, when it is first accepted, and not waited for: an email that can't be sent never holds the customer up.
      if (result === "accepted-now")
        after(async () => {
          await tellAccepted(token);
          // The order opens in the Ordering Station and the installation allowance is kept for Installer Invoices.
          const job = await proposalJob(token).catch(() => null);
          if (job) await afterSigning(job.businessId, job.jobId);
        });
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
    if (read.body.action === "paid") {
      if (!allow(request, "proposal-paid", 20)) return slowDown();
      // Only the way is taken from what was sent; whether this proposal offers it is checked beside the proposal itself.
      const way = PAID_WAYS.find((w) => w === read.body.way) as PaidWay | undefined;
      if (!way) return Response.json({ ok: false, message: PAID_WAY_WRONG }, { status: 422 });
      const result = await sayPaid(token, way, today);
      if (!result) return notFound();
      if (result === "said-now") after(() => tellPaid(token));
      if (result === "not-accepted") return Response.json({ ok: false, message: NOT_ACCEPTED }, { status: 409 });
      if (result === "no-deposit") return Response.json({ ok: false, message: NO_DEPOSIT }, { status: 409 });
      if (result === "no-such-way") return Response.json({ ok: false, message: PAID_WAY_WRONG }, { status: 422 });
      const found = await publicProposal(token, today);
      return Response.json({ ok: true, ...found }, { headers: PRIVATE });
    }
    return Response.json({ ok: false, message: "That can't be done here." }, { status: 400 });
  });
}
