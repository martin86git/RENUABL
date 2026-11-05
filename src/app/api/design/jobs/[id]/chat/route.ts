import { cleanLine, replyOutcome, unanswered } from "@/lib/domain/design/chat";
import { memberReplies } from "@/lib/server/design-chat";
import { chatLines, markRead } from "@/lib/server/design-chat-repo";
import { answer, readBody, requireMember, viewerOf } from "@/lib/server/design-context";
import { jobById } from "@/lib/server/design-crm-repo";
import { tokenForJob } from "@/lib/server/design-proposal-repo";
import { allow } from "@/lib/server/rate-limit";
import { formFiles } from "@/lib/server/email-parts";

const validId = (id: string) => /^job_[a-f0-9]{8,64}$/.test(id);
const notFound = () => Response.json({ ok: false, message: "That job isn't here." }, { status: 404 });

/**
 * GET: one of the business's jobs' conversation with its customer, for the
 * business's own people: every line, who at the business wrote each of
 * theirs, how many of the customer's latest lines are unanswered, and
 * whether the customer has a proposal to read replies on.
 */
export async function GET(_request: Request, ctx: RouteContext<"/api/design/jobs/[id]/chat">) {
  return answer(async () => {
    const { id } = await ctx.params;
    const who = await requireMember("design");
    if ("refuse" in who) return who.refuse;
    const found = validId(id) ? await jobById(who.member.businessId, id, viewerOf(who.member)) : null;
    if (!found) return notFound();
    const lines = await chatLines(who.member.businessId, id, who.member.email);
    return Response.json({
      ok: true,
      lines,
      unanswered: unanswered(lines),
      customer: found.customer.name,
      // Replies are read on the customer's proposal: without one out, there is nowhere for them to see a reply.
      hasProposal: Boolean(await tokenForJob(who.member.businessId, id)),
    });
  });
}

/**
 * POST { text }: a member replies. Who it is from is the signed-in member,
 * kept for the business's own record and never shown to the customer, who
 * sees it as from the business's team at their next look. The answer says
 * whether the customer was also emailed, and why not when they weren't.
 */
export async function POST(request: Request, ctx: RouteContext<"/api/design/jobs/[id]/chat">) {
  return answer(async () => {
    const { id } = await ctx.params;
    const who = await requireMember("design");
    if ("refuse" in who) return who.refuse;
    if (!allow(request, "design-chat-reply", 300))
      return Response.json({ ok: false, message: "Try again in a little while." }, { status: 429 });
    // JSON, or a form when pictures or files go with it (they travel only in the email to the customer).
    let raw: Record<string, unknown>;
    let files: File[] = [];
    if ((request.headers.get("content-type") ?? "").startsWith("multipart/form-data")) {
      const form = await request.formData().catch(() => null);
      if (!form) return Response.json({ ok: false, message: "That couldn't be read." }, { status: 400 });
      raw = { text: form.get("text") };
      const got = formFiles(form);
      if ("problem" in got) return Response.json({ ok: false, message: got.problem }, { status: 422 });
      files = got.files;
    } else {
      const read = await readBody(request, 10_000);
      if ("refuse" in read) return read.refuse;
      raw = read.body;
    }
    const line = cleanLine(raw);
    if (!line.ok) return Response.json({ ok: false, message: line.message }, { status: 422 });
    const replied = validId(id) ? await memberReplies(who.member, id, line.value.text, files) : null;
    if (!replied) return notFound();
    if ("refused" in replied) return Response.json({ ok: false, message: replied.refused }, { status: 422 });
    return Response.json({ ok: true, lines: replied.lines, unanswered: 0, email: replied.email, outcome: replyOutcome(replied.email) });
  });
}

/**
 * PUT: marks the customer's lines in this conversation as seen by this member (opening the chat does it; so does the
 * button in Messages). Each member's own: the rest of the team still sees them as new.
 */
export async function PUT(_request: Request, ctx: RouteContext<"/api/design/jobs/[id]/chat">) {
  return answer(async () => {
    const { id } = await ctx.params;
    const who = await requireMember("design");
    if ("refuse" in who) return who.refuse;
    if (!validId(id) || !(await jobById(who.member.businessId, id, viewerOf(who.member)))) return notFound();
    return Response.json({ ok: true, marked: await markRead(who.member.businessId, id, who.member.email) });
  });
}
