import { after } from "next/server";
import { cleanLine } from "@/lib/domain/design/chat";
import { answer, readBody } from "@/lib/server/design-context";
import { helloChat, helloSays } from "@/lib/server/design-hello";
import { allow } from "@/lib/server/rate-limit";

const notFound = () => Response.json({ ok: false, message: "This page isn't available." }, { status: 404 });
const slowDown = () => Response.json({ ok: false, message: "Try again in a little while." }, { status: 429 });
const PRIVATE = { "cache-control": "private, no-store", "x-robots-tag": "noindex, nofollow", "referrer-policy": "no-referrer" };

/** GET: the deal's conversation as the lead behind the link may see it (the same one their proposal's chat carries on). */
export async function GET(request: Request, ctx: RouteContext<"/api/hello/[token]/chat">) {
  return answer(async () => {
    const { token } = await ctx.params;
    if (!allow(request, "hello-chat-read", 600)) return slowDown();
    const chat = await helloChat(token);
    return chat ? Response.json({ ok: true, ...chat }, { headers: PRIVATE }) : notFound();
  });
}

/** POST { text }: the lead writes. Only the words are taken; who it is from is decided by the link. Sol answers after. */
export async function POST(request: Request, ctx: RouteContext<"/api/hello/[token]/chat">) {
  return answer(async () => {
    const { token } = await ctx.params;
    if (!allow(request, "hello-chat", 30)) return slowDown();
    const read = await readBody(request, 10_000);
    if ("refuse" in read) return read.refuse;
    const line = cleanLine(read.body);
    if (!line.ok) return Response.json({ ok: false, message: line.message }, { status: 422 });
    const said = await helloSays(token, line.value.text, after);
    if (!said) return notFound();
    if ("problem" in said) return Response.json({ ok: false, message: said.problem }, { status: said.status });
    return Response.json({ ok: true, ...said.chat }, { headers: PRIVATE });
  });
}
