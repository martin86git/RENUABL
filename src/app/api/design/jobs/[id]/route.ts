import { cleanJobInput } from "@/lib/domain/design/crm";
import { answer, readBody, requireMember } from "@/lib/server/design-context";
import { deleteJob, jobById, updateJob } from "@/lib/server/design-crm-repo";

const validId = (id: string) => /^job_[a-f0-9]{8,64}$/.test(id);
/** The same answer for an id that doesn't exist and one that is another business's. */
const notFound = () => Response.json({ ok: false, message: "That job isn't here." }, { status: 404 });

/** GET: one job and its customer. Its address and place on the map are what the designer opens the roof with. */
export async function GET(_request: Request, ctx: RouteContext<"/api/design/jobs/[id]">) {
  return answer(async () => {
    const { id } = await ctx.params;
    const who = await requireMember("design");
    if ("refuse" in who) return who.refuse;
    const found = validId(id) ? await jobById(who.member.businessId, id) : null;
    return found ? Response.json({ ok: true, ...found }) : notFound();
  });
}

/**
 * PUT any of { title, address, lat, lng, stage, value, installDate }: changes
 * a job; what isn't sent stays. A move to another stage is written on the
 * customer's record ("Moved to Proposal sent") with who moved it.
 */
export async function PUT(request: Request, ctx: RouteContext<"/api/design/jobs/[id]">) {
  return answer(async () => {
    const { id } = await ctx.params;
    const who = await requireMember("design");
    if ("refuse" in who) return who.refuse;
    const read = await readBody(request, 20_000);
    if ("refuse" in read) return read.refuse;
    if (!validId(id)) return notFound();
    const job = await updateJob(who.member.businessId, id, (current) => cleanJobInput(read.body, current), who.member.email);
    if (!job) return notFound();
    if ("refused" in job) return Response.json({ ok: false, message: job.refused }, { status: 422 });
    return Response.json({ ok: true, job });
  });
}

/** DELETE: removes the job. What was written about it stays on the customer's record. */
export async function DELETE(_request: Request, ctx: RouteContext<"/api/design/jobs/[id]">) {
  return answer(async () => {
    const { id } = await ctx.params;
    const who = await requireMember("design");
    if ("refuse" in who) return who.refuse;
    const gone = validId(id) && (await deleteJob(who.member.businessId, id));
    return gone ? Response.json({ ok: true }) : notFound();
  });
}
