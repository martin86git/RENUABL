import { answer, readBody, requireMember } from "@/lib/server/design-context";
import { addOwnStage, listOwnStages, renameBuiltinStage, stageNamesOf } from "@/lib/server/design-crm-repo";

/** GET: the stages the business added, and its names for the twelve built in. */
export async function GET() {
  return answer(async () => {
    const who = await requireMember("design");
    if ("refuse" in who) return who.refuse;
    const [stages, names] = await Promise.all([listOwnStages(who.member.businessId), stageNamesOf(who.member.businessId)]);
    return Response.json({ ok: true, stages, names });
  });
}

/**
 * POST { name, base, pipelineId?, after? }: adds a stage that counts as `base`, and puts it into that pipeline after
 * position `after` (-1 first). Answers the stage and the pipeline as now kept.
 */
export async function POST(request: Request) {
  return answer(async () => {
    const who = await requireMember("design");
    if ("refuse" in who) return who.refuse;
    const read = await readBody(request, 2_000);
    if ("refuse" in read) return read.refuse;
    const body = (read.body && typeof read.body === "object" ? read.body : {}) as { pipelineId?: unknown; after?: unknown };
    const place =
      typeof body.pipelineId === "string" && /^[a-z0-9_-]{1,80}$/.test(body.pipelineId)
        ? { pipelineId: body.pipelineId, after: typeof body.after === "number" && Number.isInteger(body.after) ? body.after : 999 }
        : null;
    const made = await addOwnStage(who.member.businessId, read.body, place, who.member.email);
    if ("refused" in made) return Response.json({ ok: false, message: made.refused }, { status: 422 });
    return Response.json({ ok: true, ...made });
  });
}

/** PUT { stage, name }: renames one of the twelve built-in stages for the business; a blank name puts ours back. */
export async function PUT(request: Request) {
  return answer(async () => {
    const who = await requireMember("design");
    if ("refuse" in who) return who.refuse;
    const read = await readBody(request, 1_000);
    if ("refuse" in read) return read.refuse;
    const body = (read.body && typeof read.body === "object" ? read.body : {}) as { stage?: unknown; name?: unknown };
    const names = await renameBuiltinStage(who.member.businessId, body.stage, body.name);
    if ("refused" in names) return Response.json({ ok: false, message: names.refused }, { status: 422 });
    return Response.json({ ok: true, names });
  });
}
