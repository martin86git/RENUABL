import { MAX_PROJECT_BYTES, PROJECT_CONFLICT, can, cleanRoofPlace, cleanRoofWork } from "@/lib/domain/design/account";
import { keepCostEdits, withoutCostEdits } from "@/lib/domain/design/permissions";
import { answer, readBody, requireMember } from "@/lib/server/design-context";
import { deleteProject, projectById, saveProject } from "@/lib/server/design-repo";

const validId = (id: string) => /^roof_[a-f0-9]{8,64}$/.test(id);

/** GET: one of the business's roofs. Another business's roof reads as not there at all. */
export async function GET(_request: Request, ctx: RouteContext<"/api/design/projects/[id]">) {
  return answer(async () => {
    const { id } = await ctx.params;
    const who = await requireMember("design");
    if ("refuse" in who) return who.refuse;
    const project = validId(id) ? await projectById(who.member.businessId, id) : null;
    if (!project) return Response.json({ ok: false }, { status: 404 });
    // The costs typed over a quote's lines are costs: someone who may not see costs isn't sent them.
    const hidden = !can(who.member.role, "costs", who.member.permissions);
    return Response.json({ ok: true, project: hidden ? { ...project, extras: withoutCostEdits(project.extras) } : project });
  });
}

/**
 * PUT { version, design, extras, address? }: saves over the copy the browser loaded.
 * `version` is the one it loaded: if someone else has saved since, nothing is
 * changed and the answer is 409, so two people on one roof can't silently
 * undo each other. The designs stay at the roof's own place on the map.
 */
export async function PUT(request: Request, ctx: RouteContext<"/api/design/projects/[id]">) {
  return answer(async () => {
    const { id } = await ctx.params;
    const who = await requireMember("design");
    if ("refuse" in who) return who.refuse;
    const read = await readBody(request, MAX_PROJECT_BYTES);
    if ("refuse" in read) return read.refuse;
    const project = validId(id) ? await projectById(who.member.businessId, id) : null;
    if (!project) return Response.json({ ok: false }, { status: 404 });
    // The address is only ever filled in where the roof has none (one brought across from a device); the place never moves.
    const address = project.address || (cleanRoofPlace({ ...project, address: read.body.address })?.address ?? "");
    const work = cleanRoofWork({ ...project, address }, read.body.design, read.body.extras);
    if (!work || !Number.isInteger(read.body.version))
      return Response.json({ ok: false, message: "That design couldn't be read." }, { status: 422 });
    // Someone who can't see costs was never sent the costs typed over the quote's lines: what the business had stays.
    if (!can(who.member.role, "costs", who.member.permissions)) work.extras = keepCostEdits(work.extras, project.extras);
    const saved = await saveProject(who.member.businessId, id, read.body.version as number, work, who.member.email, address);
    if (saved === "missing") return Response.json({ ok: false }, { status: 404 });
    if (saved === "conflict") return Response.json({ ok: false, conflict: true, message: PROJECT_CONFLICT }, { status: 409 });
    return Response.json({ ok: true, version: saved.version });
  });
}

/** DELETE: removes one of the business's roofs. */
export async function DELETE(_request: Request, ctx: RouteContext<"/api/design/projects/[id]">) {
  return answer(async () => {
    const { id } = await ctx.params;
    const who = await requireMember("design");
    if ("refuse" in who) return who.refuse;
    const gone = validId(id) && (await deleteProject(who.member.businessId, id));
    return gone ? Response.json({ ok: true }) : Response.json({ ok: false }, { status: 404 });
  });
}
