import { cleanActivityInput } from "@/lib/domain/design/crm";
import { answer, readBody, requireMember, viewerOf } from "@/lib/server/design-context";
import { addActivity, jobById } from "@/lib/server/design-crm-repo";
import { notifyMentions } from "@/lib/server/design-notifications-repo";

const validId = (id: string) => /^cus_[a-f0-9]{8,64}$/.test(id);

/**
 * POST { kind: "note" | "call" | "email", text, jobId? }: writes on a
 * customer's record. Who wrote it is the signed-in member and the time is the
 * server's: neither is taken from the browser. A stage move can't be sent
 * here (the server records those itself when a job moves). Written on a deal,
 * any member it @mentions is notified (and emailed when email is set up); the
 * answer names them.
 */
export async function POST(request: Request, ctx: RouteContext<"/api/design/customers/[id]/activity">) {
  return answer(async () => {
    const { id } = await ctx.params;
    const who = await requireMember("design");
    if ("refuse" in who) return who.refuse;
    const read = await readBody(request, 20_000);
    if ("refuse" in read) return read.refuse;
    const input = cleanActivityInput(read.body);
    if (!input.ok) return Response.json({ ok: false, message: input.message }, { status: 422 });
    // On a deal, only one the member sees.
    if (input.value.jobId && !(await jobById(who.member.businessId, input.value.jobId, viewerOf(who.member))))
      return Response.json({ ok: false, message: "That job isn't one of this customer's." }, { status: 422 });
    const activity = validId(id) ? await addActivity(who.member.businessId, id, input.value, who.member.email) : "missing";
    if (activity === "missing") return Response.json({ ok: false, message: "That customer isn't here." }, { status: 404 });
    if (activity === "not-their-job")
      return Response.json({ ok: false, message: "That job isn't one of this customer's." }, { status: 422 });
    const mentioned = input.value.jobId
      ? await notifyMentions(who.member.businessId, {
          jobId: input.value.jobId,
          customerId: id,
          text: input.value.text,
          by: who.member.email,
        }).catch(() => [] as string[])
      : [];
    return Response.json({ ok: true, activity, mentioned });
  });
}
