import { asBuiltDifferences, cleanAsBuilt } from "@/lib/domain/design/as-built";
import { installerBy, isJobToken } from "@/lib/domain/design/job-card";
import { answer, readBody } from "@/lib/server/design-context";
import { cardByToken, jobCard, saveAsBuilt } from "@/lib/server/design-job-card-repo";
import { allow } from "@/lib/server/rate-limit";

const gone = () => Response.json({ ok: false, message: "This job card isn't available." }, { status: 404 });

/**
 * PUT { asBuilt, person } → { asBuilt }: the installer records what they really installed, with its serial numbers,
 * from their private job card link (no sign-in; only that job, only while they are on the business's file).
 */
export async function PUT(request: Request, ctx: RouteContext<"/api/job/[token]/as-built">) {
  return answer(async () => {
    const { token } = await ctx.params;
    if (!allow(request, "job-card-as-built", 60))
      return Response.json({ ok: false, message: "Try again in a little while." }, { status: 429 });
    const link = isJobToken(token) ? await cardByToken(token) : null;
    if (!link) return gone();
    const read = await readBody(request, 60_000);
    if ("refuse" in read) return read.refuse;
    const card = await jobCard({ businessId: link.businessId, businessName: link.businessName }, link.jobId, true);
    if (!card) return gone();
    const input = cleanAsBuilt(read.body.asBuilt);
    const differences = card.designed ? asBuiltDifferences(input, card.designed) : [];
    const saved = await saveAsBuilt(link.businessId, link.jobId, input, installerBy(link.installer.name, read.body.person), differences);
    return saved ? Response.json({ ok: true, asBuilt: saved }) : gone();
  });
}
