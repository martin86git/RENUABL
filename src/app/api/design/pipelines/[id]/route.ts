import { cleanPipelineInput } from "@/lib/domain/design/crm";
import { answer, readBody, requireMember } from "@/lib/server/design-context";
import { deletePipeline, updatePipeline } from "@/lib/server/design-crm-repo";

const validId = (id: string) => /^pipe_[a-f0-9]{8,64}$/.test(id);
/** The same answer for an id that doesn't exist and one that is another business's. */
const notFound = () => Response.json({ ok: false, message: "That pipeline isn't here." }, { status: 404 });

/** PUT { name, stages }: renames one of the business's pipelines or changes its stages. */
export async function PUT(request: Request, ctx: RouteContext<"/api/design/pipelines/[id]">) {
  return answer(async () => {
    const { id } = await ctx.params;
    const who = await requireMember("design");
    if ("refuse" in who) return who.refuse;
    const read = await readBody(request, 5_000);
    if ("refuse" in read) return read.refuse;
    if (!validId(id)) return notFound();
    const input = cleanPipelineInput(read.body);
    if (!input.ok) return Response.json({ ok: false, message: input.message }, { status: 422 });
    const pipeline = await updatePipeline(who.member.businessId, id, input.value);
    return pipeline ? Response.json({ ok: true, pipeline }) : notFound();
  });
}

/** DELETE: removes one of the business's pipelines. Its deals are untouched. */
export async function DELETE(_request: Request, ctx: RouteContext<"/api/design/pipelines/[id]">) {
  return answer(async () => {
    const { id } = await ctx.params;
    const who = await requireMember("design");
    if ("refuse" in who) return who.refuse;
    const gone = validId(id) && (await deletePipeline(who.member.businessId, id));
    return gone ? Response.json({ ok: true }) : notFound();
  });
}
