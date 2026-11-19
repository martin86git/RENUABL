import { after } from "next/server";
import { answer, readBody } from "@/lib/server/design-context";
import { holdWeek } from "@/lib/server/design-configurator";
import { allow } from "@/lib/server/rate-limit";

const PRIVATE = { "cache-control": "private, no-store", "x-robots-tag": "noindex, nofollow", "referrer-policy": "no-referrer" };

/**
 * POST { action: "hold", option }: the customer holding the first free install week for the mix they chose in the
 * configurator, on an indicative proposal (19 Nov 2026). Keyed only by the proposal's private link; only the mix is
 * taken from the browser, checked against what the proposal was published with, and the week is the calendar's own.
 * Nothing is charged and nothing is agreed.
 */
export async function POST(request: Request, ctx: RouteContext<"/api/proposal/[token]/configure">) {
  return answer(async () => {
    const { token } = await ctx.params;
    const read = await readBody(request, 2_000);
    if ("refuse" in read) return read.refuse;
    if (read.body.action !== "hold") return Response.json({ ok: false, message: "That can't be done here." }, { status: 400 });
    if (!allow(request, "proposal-hold", 10)) return Response.json({ ok: false, message: "Try again in a little while." }, { status: 429 });
    const result = await holdWeek(token, read.body.option, (work) => after(work));
    if (!result) return Response.json({ ok: false, message: "This proposal isn't available." }, { status: 404 });
    if (!result.ok) return Response.json({ ok: false, message: result.message }, { status: result.status });
    return Response.json({ ok: true, week: result.week }, { headers: PRIVATE });
  });
}
