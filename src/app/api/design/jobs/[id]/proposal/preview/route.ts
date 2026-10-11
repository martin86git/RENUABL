import { answer, readBody, requireMember } from "@/lib/server/design-context";
import { workOutProposal } from "@/lib/server/design-proposal";
import { NO_DESIGN } from "@/lib/server/design-proposal-repo";

/**
 * POST { template, validDays, note }: the proposal as it would go out now,
 * worked out from what is saved and kept nowhere. Answers with the customer's
 * copy only (`view`: never a cost) and the saved roof's version, which
 * publishing sends back so it publishes exactly this. When something stops
 * it being sent, `problems` says what to fix.
 */
export async function POST(request: Request, ctx: RouteContext<"/api/design/jobs/[id]/proposal/preview">) {
  return answer(async () => {
    const { id } = await ctx.params;
    const who = await requireMember("design");
    if ("refuse" in who) return who.refuse;
    const read = await readBody(request, 10_000);
    if ("refuse" in read) return read.refuse;
    const worked = /^job_[a-f0-9]{8,64}$/.test(id) ? await workOutProposal(who.member, id, read.body) : null;
    if (!worked) return Response.json({ ok: false, message: "That job isn't here." }, { status: 404 });
    if (worked === NO_DESIGN) return Response.json({ ok: true, view: null, problems: [NO_DESIGN], choice: null, projectVersion: null });
    const { built, choice, saved } = worked;
    return Response.json({
      ok: true,
      view: built.ok ? built.view : null,
      problems: built.ok ? [] : built.problems,
      choice,
      projectVersion: saved.project.version,
    });
  });
}
