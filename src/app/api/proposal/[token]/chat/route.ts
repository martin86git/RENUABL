import { after } from "next/server";
import { cleanLine } from "@/lib/domain/design/chat";
import { customerSays, publicChat } from "@/lib/server/design-chat";
import { answer, readBody } from "@/lib/server/design-context";
import { allow } from "@/lib/server/rate-limit";

/** A link we never made and one that doesn't exist answer the same. */
const notFound = () => Response.json({ ok: false, message: "This proposal isn't available." }, { status: 404 });
const slowDown = () => Response.json({ ok: false, message: "Try again in a little while." }, { status: 429 });
const PRIVATE = { "cache-control": "private, no-store", "x-robots-tag": "noindex, nofollow", "referrer-policy": "no-referrer" };

/**
 * GET: the conversation on the proposal behind a private link, for the
 * customer it was sent to. The link is the key, and it opens that one job's
 * conversation only. Each line is sent as its side, its words and its time:
 * never who at the business wrote it. The page asks again every 20 seconds
 * while the chat is open, hence the generous limit.
 */
export async function GET(request: Request, ctx: RouteContext<"/api/proposal/[token]/chat">) {
  return answer(async () => {
    const { token } = await ctx.params;
    if (!allow(request, "proposal-chat-read", 600)) return slowDown();
    const chat = await publicChat(token);
    return chat ? Response.json({ ok: true, ...chat }, { headers: PRIVATE }) : notFound();
  });
}

/**
 * POST { text }: the customer writes. Only the words are taken from what is
 * sent: that it is from the customer is decided here, by the link it came
 * through. Limited for each visitor and capped for each job; not taken once
 * the proposal is withdrawn. The business is told by email after the answer
 * has gone back, so a slow or failing email never holds the message up.
 */
export async function POST(request: Request, ctx: RouteContext<"/api/proposal/[token]/chat">) {
  return answer(async () => {
    const { token } = await ctx.params;
    if (!allow(request, "proposal-chat", 30)) return slowDown();
    const read = await readBody(request, 10_000);
    if ("refuse" in read) return read.refuse;
    const line = cleanLine(read.body);
    if (!line.ok) return Response.json({ ok: false, message: line.message }, { status: 422 });
    const said = await customerSays(token, line.value.text, after);
    if (!said) return notFound();
    if ("problem" in said) return Response.json({ ok: false, message: said.problem }, { status: said.status });
    return Response.json({ ok: true, ...said.chat }, { headers: PRIVATE });
  });
}
