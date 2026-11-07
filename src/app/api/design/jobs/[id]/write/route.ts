import { cleanWriteAsk } from "@/lib/domain/design/deal-write";
import { answer, readBody, requireMember, viewerOf } from "@/lib/server/design-context";
import { solWritesEmail } from "@/lib/server/design-feed";
import { allow } from "@/lib/server/rate-limit";

const validId = (id: string) => /^job_[a-f0-9]{8,64}$/.test(id);

/**
 * POST { ask } → { subject, body }: Write with Sol from a card on Today (deal-write.ts): an email to the deal's
 * customer for the member to change and send through the deal's own email. Nothing is sent or kept here.
 */
export async function POST(request: Request, ctx: RouteContext<"/api/design/jobs/[id]/write">) {
  return answer(async () => {
    const { id } = await ctx.params;
    const who = await requireMember("design");
    if ("refuse" in who) return who.refuse;
    if (!allow(request, "design-feed-write", 60))
      return Response.json({ ok: false, message: "That's a lot at once. Try again in a few minutes." }, { status: 429 });
    const read = await readBody(request, 4_000);
    if ("refuse" in read) return read.refuse;
    const asked = cleanWriteAsk(read.body);
    if (!asked.ok) return Response.json({ ok: false, message: asked.message }, { status: 422 });
    if (!validId(id)) return Response.json({ ok: false, message: "That deal isn't here." }, { status: 404 });
    const drafted = await solWritesEmail(who.member, id, asked.ask, viewerOf(who.member));
    if ("problem" in drafted) return Response.json({ ok: false, message: drafted.problem }, { status: drafted.status });
    return Response.json({ ok: true, ...drafted });
  });
}
