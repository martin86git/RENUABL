import { PIPELINES_FULL, cleanPipelineInput } from "@/lib/domain/design/crm";
import { answer, readBody, requireMember } from "@/lib/server/design-context";
import { createPipeline, listPipelines } from "@/lib/server/design-crm-repo";

/** GET: the pipelines the business has saved, in the order they were made. */
export async function GET() {
  return answer(async () => {
    const who = await requireMember("design");
    if ("refuse" in who) return who.refuse;
    return Response.json({ ok: true, pipelines: await listPipelines(who.member.businessId) });
  });
}

/** POST { name, stages }: saves a pipeline for everyone in the business. */
export async function POST(request: Request) {
  return answer(async () => {
    const who = await requireMember("design");
    if ("refuse" in who) return who.refuse;
    const read = await readBody(request, 5_000);
    if ("refuse" in read) return read.refuse;
    const input = cleanPipelineInput(read.body);
    if (!input.ok) return Response.json({ ok: false, message: input.message }, { status: 422 });
    const pipeline = await createPipeline(who.member.businessId, input.value, who.member.email);
    if (pipeline === "full") return Response.json({ ok: false, message: PIPELINES_FULL }, { status: 422 });
    return Response.json({ ok: true, pipeline });
  });
}
