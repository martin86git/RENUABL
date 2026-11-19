import { after } from "next/server";
import { answer, readBody } from "@/lib/server/design-context";
import { orderMix } from "@/lib/server/design-configurator";
import { allow } from "@/lib/server/rate-limit";

const PRIVATE = { "cache-control": "private, no-store", "x-robots-tag": "noindex, nofollow", "referrer-policy": "no-referrer" };

/**
 * POST { action: "order", option, week, name?, agree? }: the customer's order from the configurator (19 Nov 2026).
 * Keyed only by the proposal's private link; the mix and the week are checked against what the proposal was published
 * with and what the calendar offers now. A final proposal is accepted (name and tick, as the proposal page); an
 * indicative one asks for the mix and week, to confirm at the site visit. ("hold", the first configurator's word for
 * the indicative order, is read the same.)
 */
export async function POST(request: Request, ctx: RouteContext<"/api/proposal/[token]/configure">) {
  return answer(async () => {
    const { token } = await ctx.params;
    const read = await readBody(request, 2_000);
    if ("refuse" in read) return read.refuse;
    if (read.body.action !== "order" && read.body.action !== "hold")
      return Response.json({ ok: false, message: "That can't be done here." }, { status: 400 });
    if (!allow(request, "proposal-order", 10))
      return Response.json({ ok: false, message: "Try again in a little while." }, { status: 429 });
    const result = await orderMix(token, read.body, (work) => after(work));
    if (!result) return Response.json({ ok: false, message: "This proposal isn't available." }, { status: 404 });
    if (!result.ok) return Response.json({ ok: false, message: result.message }, { status: result.status });
    return Response.json({ ok: true, kind: result.kind, week: result.week }, { headers: PRIVATE });
  });
}
