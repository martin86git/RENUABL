import { can } from "@/lib/domain/design/account";
import { answer, readBody, requireMember } from "@/lib/server/design-context";
import { workOutProposal } from "@/lib/server/design-proposal";
import { NO_DESIGN } from "@/lib/server/design-proposal-repo";
import { customProposalsAllowed } from "@/lib/server/design-addons";

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
      // Whether a custom design may be published now (the builder says so before anyone publishes).
      customAllowed: await customProposalsAllowed(who.member.businessId),
      // What the configurator left out and why (25 Nov 2026): the business's to fix on its price lists or quote.
      configuratorSkipped: built.ok ? (built.internal.configuratorSkipped ?? []) : [],
      // Whether Sol answers this business's customers: the indicative message says so when he does.
      assistant: saved.brand.solAnswers,
      // Sol's price check beside the preview (18 Nov 2026, Martin): the margin and the business's floor, only for a
      // member who sees costs. Never in the customer's copy.
      pricing:
        built.ok && built.internal.priceExGst > 0 && can(who.member.role, "costs", who.member.permissions)
          ? { marginShare: built.internal.margin / built.internal.priceExGst, floor: saved.workspace.settings.margin.floor ?? 0 }
          : null,
    });
  });
}
