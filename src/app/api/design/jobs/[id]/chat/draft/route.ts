import { cleanDraftAsk } from "@/lib/domain/design/sol-customer";
import { answer, readBody, requireMember, viewerOf } from "@/lib/server/design-context";
import { jobById } from "@/lib/server/design-crm-repo";
import { solDraftsReply } from "@/lib/server/design-sol-customer";
import { allow } from "@/lib/server/rate-limit";

const validId = (id: string) => /^job_[a-f0-9]{8,64}$/.test(id);

/**
 * POST { ask }: Sol writes a reply to the customer in this deal's chat, as the member asked, from the customer's own
 * copy of the proposal and the conversation (never a cost). It comes back as words for the member to change and send
 * as their own reply: nothing is kept or sent here. One Sol credit (the customer chat's deep tier).
 */
export async function POST(request: Request, ctx: RouteContext<"/api/design/jobs/[id]/chat/draft">) {
  return answer(async () => {
    const { id } = await ctx.params;
    const who = await requireMember("design");
    if ("refuse" in who) return who.refuse;
    if (!allow(request, "design-chat-draft", 60))
      return Response.json({ ok: false, message: "That's a lot of drafts at once. Try again in a few minutes." }, { status: 429 });
    const read = await readBody(request, 4_000);
    if ("refuse" in read) return read.refuse;
    const asked = cleanDraftAsk(read.body);
    if (!asked.ok) return Response.json({ ok: false, message: asked.message }, { status: 422 });
    const found = validId(id) ? await jobById(who.member.businessId, id, viewerOf(who.member)) : null;
    if (!found) return Response.json({ ok: false, message: "That job isn't here." }, { status: 404 });
    const drafted = await solDraftsReply(who.member.businessId, id, asked.ask, who.member.email);
    if ("problem" in drafted) return Response.json({ ok: false, message: drafted.problem }, { status: drafted.status });
    return Response.json({ ok: true, text: drafted.text });
  });
}
