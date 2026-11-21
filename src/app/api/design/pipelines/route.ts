import { PIPELINES_FULL } from "@/lib/domain/design/crm";
import { cleanPipelineSave } from "@/lib/domain/design/pipeline-stages";
import { answer, readBody, requireMember } from "@/lib/server/design-context";
import { createPipeline, listOwnStages, listPipelines } from "@/lib/server/design-crm-repo";

/** GET: the pipelines the business keeps (its own, and stand-ins for set ones it changed), and the stages it added. */
export async function GET() {
  return answer(async () => {
    const who = await requireMember("design");
    if ("refuse" in who) return who.refuse;
    const [pipelines, stages] = await Promise.all([listPipelines(who.member.businessId), listOwnStages(who.member.businessId)]);
    return Response.json({ ok: true, pipelines, stages });
  });
}

/** POST { name, stages, baseId? }: a pipeline for everyone in the business, or (baseId) a set pipeline renamed or changed. */
export async function POST(request: Request) {
  return answer(async () => {
    const who = await requireMember("design");
    if ("refuse" in who) return who.refuse;
    const read = await readBody(request, 5_000);
    if ("refuse" in read) return read.refuse;
    const input = cleanPipelineSave(read.body, await listOwnStages(who.member.businessId));
    if (!input.ok) return Response.json({ ok: false, message: input.message }, { status: 422 });
    const pipeline = await createPipeline(who.member.businessId, input.value, who.member.email);
    if (pipeline === "full") return Response.json({ ok: false, message: PIPELINES_FULL }, { status: 422 });
    return Response.json({ ok: true, pipeline });
  });
}
