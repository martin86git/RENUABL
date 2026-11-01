import { asBuiltDifferences, cleanAsBuilt } from "@/lib/domain/design/as-built";
import { jobById } from "@/lib/server/design-crm-repo";
import { answer, readBody, requireMember, viewerOf } from "@/lib/server/design-context";
import { jobCard, saveAsBuilt } from "@/lib/server/design-job-card-repo";

const missing = () => Response.json({ ok: false, message: "There's no such job." }, { status: 404 });

/**
 * PUT { asBuilt } → { asBuilt }: what was really installed on a job, recorded by the business's own people who may
 * see the deal (installers record theirs from their card, `/api/job/[token]/as-built`). Written on the deal's record.
 */
export async function PUT(request: Request, ctx: RouteContext<"/api/design/jobs/[id]/as-built">) {
  return answer(async () => {
    const who = await requireMember("design");
    if ("refuse" in who) return who.refuse;
    const { id } = await ctx.params;
    if (!(await jobById(who.member.businessId, id, viewerOf(who.member)))) return missing();
    const read = await readBody(request, 60_000);
    if ("refuse" in read) return read.refuse;
    const card = await jobCard(who.member, id);
    if (!card) return missing();
    const input = cleanAsBuilt(read.body.asBuilt);
    const differences = card.designed ? asBuiltDifferences(input, card.designed) : [];
    const saved = await saveAsBuilt(who.member.businessId, id, input, who.member.email, differences);
    return saved ? Response.json({ ok: true, asBuilt: saved }) : missing();
  });
}
