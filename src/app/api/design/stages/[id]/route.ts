import { isOwnStageId } from "@/lib/domain/design/pipeline-stages";
import { answer, readBody, requireMember } from "@/lib/server/design-context";
import { deleteOwnStage, renameOwnStage } from "@/lib/server/design-crm-repo";

/** The same answer for an id that doesn't exist and one that is another business's. */
const notFound = () => Response.json({ ok: false, message: "That stage isn't here." }, { status: 404 });

/** PUT { name }: renames a stage the business added. */
export async function PUT(request: Request, ctx: RouteContext<"/api/design/stages/[id]">) {
  return answer(async () => {
    const { id } = await ctx.params;
    const who = await requireMember("design");
    if ("refuse" in who) return who.refuse;
    const read = await readBody(request, 1_000);
    if ("refuse" in read) return read.refuse;
    if (!isOwnStageId(id)) return notFound();
    const name = (read.body && typeof read.body === "object" ? (read.body as { name?: unknown }).name : null) ?? null;
    const stage = await renameOwnStage(who.member.businessId, id, name);
    if (!stage) return notFound();
    if ("refused" in stage) return Response.json({ ok: false, message: stage.refused }, { status: 422 });
    return Response.json({ ok: true, stage });
  });
}

/** DELETE: removes a stage the business added, from every pipeline; its deals stay at the stage it counted as. */
export async function DELETE(_request: Request, ctx: RouteContext<"/api/design/stages/[id]">) {
  return answer(async () => {
    const { id } = await ctx.params;
    const who = await requireMember("design");
    if ("refuse" in who) return who.refuse;
    const gone = isOwnStageId(id) && (await deleteOwnStage(who.member.businessId, id));
    return gone ? Response.json({ ok: true }) : notFound();
  });
}
