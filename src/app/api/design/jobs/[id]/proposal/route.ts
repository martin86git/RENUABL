import { todayInMarket } from "@/lib/domain/market";
import { answer, readBody, requireMember } from "@/lib/server/design-context";
import { jobById } from "@/lib/server/design-crm-repo";
import { workOutProposal } from "@/lib/server/design-proposal";
import { NO_DESIGN, proposalVersions, publishProposal, withdrawProposal } from "@/lib/server/design-proposal-repo";

const validId = (id: string) => /^job_[a-f0-9]{8,64}$/.test(id);
const notFound = () => Response.json({ ok: false, message: "That job isn't here." }, { status: 404 });

/** GET: what has been sent for this job: every version, newest first, each with where it stands and its private link. */
export async function GET(_request: Request, ctx: RouteContext<"/api/design/jobs/[id]/proposal">) {
  return answer(async () => {
    const { id } = await ctx.params;
    const who = await requireMember("design");
    if ("refuse" in who) return who.refuse;
    if (!validId(id) || !(await jobById(who.member.businessId, id))) return notFound();
    return Response.json({ ok: true, versions: await proposalVersions(who.member.businessId, id, todayInMarket()) });
  });
}

/**
 * POST { projectVersion, template, validDays, note }: publishes the job's
 * proposal. Every figure is worked out here from what is saved; the browser
 * sends only the three choices and the version of the saved roof it was
 * looking at, so what was previewed is what goes out (409 when the roof has
 * been saved again since). Refused, with what to fix, while a quote line has
 * no cost or there is nothing drawn.
 */
export async function POST(request: Request, ctx: RouteContext<"/api/design/jobs/[id]/proposal">) {
  return answer(async () => {
    const { id } = await ctx.params;
    const who = await requireMember("publish");
    if ("refuse" in who) return who.refuse;
    const read = await readBody(request, 10_000);
    if ("refuse" in read) return read.refuse;
    const worked = validId(id) ? await workOutProposal(who.member, id, read.body) : null;
    if (!worked) return notFound();
    if (worked === NO_DESIGN) return Response.json({ ok: false, message: NO_DESIGN, problems: [NO_DESIGN] }, { status: 422 });
    if (!worked.built.ok)
      return Response.json({ ok: false, message: worked.built.problems[0], problems: worked.built.problems }, { status: 422 });
    if (read.body.projectVersion !== worked.saved.project.version)
      return Response.json(
        { ok: false, message: "The design has been saved again since this preview. Look at the new preview before sending it." },
        { status: 409 },
      );
    const kept = await publishProposal(who.member.businessId, id, worked.built, who.member.email);
    if (!kept) return notFound();
    if (kept === "raced")
      return Response.json({ ok: false, message: "Someone published this a moment ago. Reload to see it." }, { status: 409 });
    const versions = await proposalVersions(who.member.businessId, id, todayInMarket());
    const found = await jobById(who.member.businessId, id);
    return Response.json({ ok: true, proposal: versions[0], versions, job: found?.job });
  });
}

/** DELETE: takes the proposal back. Its link then shows only how to reach the business. */
export async function DELETE(_request: Request, ctx: RouteContext<"/api/design/jobs/[id]/proposal">) {
  return answer(async () => {
    const { id } = await ctx.params;
    const who = await requireMember("publish");
    if ("refuse" in who) return who.refuse;
    if (!validId(id) || !(await withdrawProposal(who.member.businessId, id, who.member.email)))
      return Response.json({ ok: false, message: "There's no proposal out for this job." }, { status: 404 });
    return Response.json({ ok: true, versions: await proposalVersions(who.member.businessId, id, todayInMarket()) });
  });
}
