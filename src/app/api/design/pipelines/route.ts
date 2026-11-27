import { PIPELINES_FULL } from "@/lib/domain/design/crm";
import { cleanPipelineSave } from "@/lib/domain/design/pipeline-stages";
import { answer, readBody, requireMember } from "@/lib/server/design-context";
import { loadPrefs, savePrefs } from "@/lib/server/design-after-sale-repo";
import { createPipeline, listOwnStages, listPipelines, stageNamesOf } from "@/lib/server/design-crm-repo";

/**
 * GET: the pipelines the business keeps (its own, and stand-ins for set ones it changed), the stages it added, its
 * names for the twelve, and whether a deal won leaves its Sales pipeline for Post sale by itself (on unless it
 * switched that off).
 */
export async function GET() {
  return answer(async () => {
    const who = await requireMember("design");
    if ("refuse" in who) return who.refuse;
    const [pipelines, stages, names, prefs] = await Promise.all([
      listPipelines(who.member.businessId),
      listOwnStages(who.member.businessId),
      stageNamesOf(who.member.businessId),
      loadPrefs(who.member.businessId),
    ]);
    return Response.json({ ok: true, pipelines, stages, names, wonLeavesSales: prefs.automations.wonLeavesSales });
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

/** PUT { wonLeavesSales }: the hand-on from Sales to Post sale, on or off, for a member who may change settings. */
export async function PUT(request: Request) {
  return answer(async () => {
    const who = await requireMember("prices");
    if ("refuse" in who) return who.refuse;
    const read = await readBody(request, 1_000);
    if ("refuse" in read) return read.refuse;
    const on = read.body.wonLeavesSales;
    if (typeof on !== "boolean") return Response.json({ ok: false, message: "Choose on or off." }, { status: 422 });
    const prefs = await loadPrefs(who.member.businessId);
    const next = { ...prefs, automations: { ...prefs.automations, wonLeavesSales: on } };
    const saved = await savePrefs(who.member.businessId, next, who.member.email);
    return Response.json({ ok: true, wonLeavesSales: saved.automations.wonLeavesSales });
  });
}
