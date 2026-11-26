import { liveWordsOf, ownCall, startLiveWords, stopLiveWords } from "@/lib/server/browser-calls";
import { answer, requireMember } from "@/lib/server/design-context";
import { allow } from "@/lib/server/rate-limit";

const gone = () => Response.json({ ok: false, message: "There's no such call." }, { status: 404 });

/**
 * The live words of the member's own call from the computer (26 Nov 2026, Martin: the note-taker on a computer call,
 * with a live transcript). POST has Twilio transcribe both sides from now on (`on`: "on", or "off" where it can't, and
 * the note-taker hears the member's side in the browser); DELETE stops it; GET ?from=n → the final stretches from n on,
 * what is still being made out on each side, and whether it is on. Only the member who made the call.
 */
async function call(ctx: RouteContext<"/api/design/calls/browser/[id]/live">) {
  const who = await requireMember("design");
  if ("refuse" in who) return { refuse: who.refuse };
  const { id } = await ctx.params;
  const row = await ownCall(id, who.member.businessId, who.member.email);
  return row ? { row } : { refuse: gone() };
}

export async function GET(request: Request, ctx: RouteContext<"/api/design/calls/browser/[id]/live">) {
  return answer(async () => {
    const got = await call(ctx);
    if ("refuse" in got) return got.refuse;
    const from = Math.max(0, Math.floor(Number(new URL(request.url).searchParams.get("from") ?? 0)) || 0);
    return Response.json({ ok: true, ...(await liveWordsOf(got.row.id, from)) }, { headers: { "cache-control": "no-store" } });
  });
}

export async function POST(request: Request, ctx: RouteContext<"/api/design/calls/browser/[id]/live">) {
  return answer(async () => {
    const got = await call(ctx);
    if ("refuse" in got) return got.refuse;
    if (!allow(request, `design-call-live:${got.row.id}`, 30))
      return Response.json({ ok: false, message: "Too many tries on this call." }, { status: 429 });
    return Response.json({ ok: true, on: await startLiveWords(got.row) });
  });
}

export async function DELETE(_request: Request, ctx: RouteContext<"/api/design/calls/browser/[id]/live">) {
  return answer(async () => {
    const got = await call(ctx);
    if ("refuse" in got) return got.refuse;
    await stopLiveWords(got.row);
    return Response.json({ ok: true });
  });
}
