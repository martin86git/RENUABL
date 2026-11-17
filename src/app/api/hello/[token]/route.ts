import { after } from "next/server";
import { cleanHomeAnswer } from "@/lib/domain/design/first-contact";
import { answer, readBody } from "@/lib/server/design-context";
import { answerHome, helloView, markHelloSeen } from "@/lib/server/design-hello";
import { allow } from "@/lib/server/rate-limit";

const notFound = () => Response.json({ ok: false, message: "This page isn't available." }, { status: 404 });
const slowDown = () => Response.json({ ok: false, message: "Try again in a little while." }, { status: 429 });
const PRIVATE = { "cache-control": "private, no-store", "x-robots-tag": "noindex, nofollow", "referrer-policy": "no-referrer" };

/**
 * GET: a new lead's own page (domain/design/first-contact.ts), for the lead it was made for. The link is the key. With
 * `?seen=1` (sent by the page in a browser, so a link preview doesn't count) the first opening is written on the deal.
 */
export async function GET(request: Request, ctx: RouteContext<"/api/hello/[token]">) {
  return answer(async () => {
    const { token } = await ctx.params;
    if (!allow(request, "hello-read", 300)) return slowDown();
    const view = await helloView(token);
    if (!view) return notFound();
    if (new URL(request.url).searchParams.get("seen") === "1") after(() => markHelloSeen(token).catch(() => {}));
    return Response.json({ ok: true, view }, { headers: PRIVATE });
  });
}

/** POST { home: "yes" | "no" }: "Is this your home?" answered. A later answer replaces an earlier one. */
export async function POST(request: Request, ctx: RouteContext<"/api/hello/[token]">) {
  return answer(async () => {
    const { token } = await ctx.params;
    if (!allow(request, "hello-home", 20)) return slowDown();
    const read = await readBody(request, 1_000);
    if ("refuse" in read) return read.refuse;
    const home = cleanHomeAnswer((read.body as { home?: unknown } | null)?.home);
    if (!home) return Response.json({ ok: false, message: "Choose yes or no." }, { status: 422 });
    if (!(await answerHome(token, home))) return notFound();
    const view = await helloView(token);
    return view ? Response.json({ ok: true, view }, { headers: PRIVATE }) : notFound();
  });
}
