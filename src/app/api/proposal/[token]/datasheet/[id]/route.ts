import { isDatasheetId } from "@/lib/domain/design/proposal-datasheets";
import { datasheetResponse } from "@/lib/server/datasheet-response";
import { answer } from "@/lib/server/design-context";
import { publicDatasheet } from "@/lib/server/design-proposal-repo";
import { allow } from "@/lib/server/rate-limit";

/**
 * GET: one product's datasheet from the proposal behind a private link (26 Nov 2026). Only a product that proposal
 * quotes, by the id its page was sent; the file is the maker's sheet as kept for the business. Sandboxed: nothing in it runs.
 */
export async function GET(request: Request, ctx: RouteContext<"/api/proposal/[token]/datasheet/[id]">) {
  return answer(async () => {
    const { token, id } = await ctx.params;
    if (!allow(request, "proposal-datasheet", 120)) return new Response(null, { status: 429 });
    const ok = /^[a-f0-9]{48}$/.test(token) && isDatasheetId(id);
    return datasheetResponse(ok ? await publicDatasheet(token, id) : null);
  });
}
