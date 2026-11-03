import { billFieldsFromFile } from "@/lib/domain/design/design-bill";
import { cleanExtras } from "@/lib/domain/design/quote";
import { parseApiKey, redactSecrets } from "@/lib/server/bill-reader";
import { answer, readBody, requireMember, viewerOf } from "@/lib/server/design-context";
import { jobById } from "@/lib/server/design-crm-repo";
import { findUsageInFile } from "@/lib/server/design-usage";
import { allow } from "@/lib/server/rate-limit";
import { SOL_OUT_SHORT } from "@/lib/domain/design/sol-credits";
import { withSolCredit } from "@/lib/server/sol-credits";

export const maxDuration = 60;

const EMPTY = { interval: "quarterly" as const, amount: "", supplyPerDay: "", rate: "", feedIn: "" };

/**
 * POST { current } (the bill box as it stands): Sol looks through the deal's file for what the home uses and sends back
 * the box's new figures with the words he found them in, to be checked. Nothing is saved here: saving the design keeps
 * them, as when typed. Only for a member who may see the deal.
 */
export async function POST(request: Request, ctx: RouteContext<"/api/design/jobs/[id]/usage">) {
  return answer(async () => {
    const who = await requireMember("design");
    if ("refuse" in who) return who.refuse;
    const { id } = await ctx.params;
    const found = await jobById(who.member.businessId, id, viewerOf(who.member));
    if (!found) return Response.json({ ok: false, message: "There's no such deal." }, { status: 404 });
    const read = await readBody(request, 20_000);
    if ("refuse" in read) return read.refuse;
    if (!allow(request, "design-usage", 60))
      return Response.json(
        { ok: false, message: "Sol has looked a lot in the last hour. Try again shortly, or type it in." },
        { status: 429 },
      );
    const apiKey = parseApiKey(process.env.ANTHROPIC_API_KEY);
    if (!apiKey) return Response.json({ ok: false, message: "Sol can't read files here: Claude isn't set up." }, { status: 503 });
    const current = cleanExtras({ bill: read.body.current }, 1, { bill: EMPTY, postcode: "" }).bill;
    try {
      const usage = await withSolCredit(who.member.businessId, "usage", who.member.email, (ai) =>
        findUsageInFile(who.member.businessId, found.job, found.customer, apiKey, ai),
      );
      if (usage === "out") return Response.json({ ok: false, message: SOL_OUT_SHORT }, { status: 402 });
      return Response.json(billFieldsFromFile(usage, current));
    } catch (e) {
      console.error("usage from the customer's file failed", redactSecrets(e instanceof Error ? e.message : String(e)));
      return Response.json(
        { ok: false, message: "Sol couldn't look through the file just now. Try again, or type it in." },
        { status: 502 },
      );
    }
  });
}
