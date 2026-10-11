import { todayInMarket } from "@/lib/domain/market";
import { answer, readBody, requireMember } from "@/lib/server/design-context";
import { markDeposit, proposalVersions } from "@/lib/server/design-proposal-repo";

const validId = (id: string) => /^job_[a-f0-9]{8,64}$/.test(id);

/**
 * PUT { received: true | false }: the business marks a job's deposit
 * received, or not received (which sets aside what the customer said, so it
 * is due again). For a member who may publish proposals. It is the
 * business's own record of its own account: no payment is taken or checked
 * here. Written on the customer's record with who did it. Answers with the
 * job's proposal versions as they now stand.
 */
export async function PUT(request: Request, ctx: RouteContext<"/api/design/jobs/[id]/deposit">) {
  return answer(async () => {
    const { id } = await ctx.params;
    const who = await requireMember("publish");
    if ("refuse" in who) return who.refuse;
    const read = await readBody(request, 1_000);
    if ("refuse" in read) return read.refuse;
    // A switch is only ever moved by an explicit true or false.
    if (typeof read.body.received !== "boolean")
      return Response.json({ ok: false, message: "Say whether the deposit has been received." }, { status: 422 });
    if (!validId(id) || !(await markDeposit(who.member.businessId, id, read.body.received, who.member.email)))
      return Response.json({ ok: false, message: "There's no accepted proposal with a deposit for this job." }, { status: 404 });
    return Response.json({ ok: true, versions: await proposalVersions(who.member.businessId, id, todayInMarket()) });
  });
}
