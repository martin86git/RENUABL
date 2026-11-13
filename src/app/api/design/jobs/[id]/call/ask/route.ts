import { ASK_REFUSAL_WORDS } from "@/lib/domain/design/call-consent";
import { askForCall } from "@/lib/server/design-call-consent";
import { answer, requireMember, viewerOf } from "@/lib/server/design-context";
import { allow } from "@/lib/server/rate-limit";

const validId = (id: string) => /^job_[a-f0-9]{8,64}$/.test(id);

/**
 * POST → { ok, message }: emails the deal's customer to ask whether they'd like a call from the business's phone
 * assistant (domain/design/call-consent.ts). Their Yes lines up the call; a No stops it. Members who may publish and
 * see the deal; the email goes to the address on the customer's record.
 */
export async function POST(request: Request, ctx: RouteContext<"/api/design/jobs/[id]/call/ask">) {
  return answer(async () => {
    const who = await requireMember("publish");
    if ("refuse" in who) return who.refuse;
    if (!allow(request, "design-call-ask", 30))
      return Response.json({ ok: false, message: "That's a lot of emails at once. Try again later." }, { status: 429 });
    const { id } = await ctx.params;
    if (!validId(id)) return Response.json({ ok: false, message: ASK_REFUSAL_WORDS.missing }, { status: 404 });
    const out = await askForCall(who.member, id, viewerOf(who.member));
    if (out.ok)
      return Response.json({
        ok: true,
        message: `Asked ${out.email} whether they'd like a call. ${out.assistant} calls once they say yes.`,
      });
    return Response.json({ ok: false, message: ASK_REFUSAL_WORDS[out.why] }, { status: out.why === "missing" ? 404 : 409 });
  });
}
