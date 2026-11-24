import { cleanJobInput } from "@/lib/domain/design/crm";
import { typedFields } from "@/lib/domain/design/deal-sections";
import { loadPrefs } from "@/lib/server/design-after-sale-repo";
import { answer, readBody, requireMember, viewerOf } from "@/lib/server/design-context";
import { mayOwnDeals } from "@/lib/server/design-repo";
import { deleteJob, jobById, joinNearbyDesign, listOwnStages, setJobOwner, updateJob } from "@/lib/server/design-crm-repo";

const validId = (id: string) => /^job_[a-f0-9]{8,64}$/.test(id);
/** The same answer for an id that doesn't exist and one that is another business's. */
const notFound = () => Response.json({ ok: false, message: "That job isn't here." }, { status: 404 });

/** GET: one job and its customer. Its address and place on the map are what the designer opens the roof with. */
export async function GET(_request: Request, ctx: RouteContext<"/api/design/jobs/[id]">) {
  return answer(async () => {
    const { id } = await ctx.params;
    const who = await requireMember("design");
    if ("refuse" in who) return who.refuse;
    // A deal the member doesn't see (someone else's, when they don't see every deal) answers as if it weren't there.
    let found = validId(id) ? await jobById(who.member.businessId, id, viewerOf(who.member)) : null;
    // A deal with no design yet looks for one of the same home drawn a few metres off (an imported deal's place).
    if (found && !found.job.projectId && found.job.lat !== null && !who.member.viewedBy) {
      await joinNearbyDesign(who.member.businessId, id, who.member.email);
      found = (await jobById(who.member.businessId, id, viewerOf(who.member))) ?? found;
    }
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
    if (!validId(id) || !(await jobById(who.member.businessId, id, viewerOf(who.member)))) return notFound();
    // { owner }: the deal given to a member of the business, someone kept to own deals without an invite, or no one (null).
    if ("owner" in read.body) {
      const owner = typeof read.body.owner === "string" ? read.body.owner.trim().toLowerCase() : null;
      if (owner && !(await mayOwnDeals(who.member.businessId, owner)))
        return Response.json({ ok: false, message: "That person isn't in your business." }, { status: 422 });
      const given = await setJobOwner(who.member.businessId, id, owner || null, who.member.email);
      return given ? Response.json({ ok: true, job: given }) : notFound();
    }
    // A deal's fields are cleaned against the business's own (Settings → Deal fields): its dropdown choices, its own fields.
    const fields = typedFields((await loadPrefs(who.member.businessId)).dealFields);
    // A deal put at a stage the business added (`subStage`) is checked against its own stages.
    const own = "subStage" in read.body ? await listOwnStages(who.member.businessId) : [];
    const job = await updateJob(who.member.businessId, id, (current) => cleanJobInput(read.body, current, fields, own), who.member.email);
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
    const gone =
      validId(id) &&
      Boolean(await jobById(who.member.businessId, id, viewerOf(who.member))) &&
      (await deleteJob(who.member.businessId, id));
    return gone ? Response.json({ ok: true }) : notFound();
  });
}
