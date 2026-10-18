import { answer } from "@/lib/server/design-context";
import { termsResponse } from "@/lib/server/design-images";
import { publicTerms } from "@/lib/server/design-proposal-repo";
import { allow } from "@/lib/server/rate-limit";

/** GET: the business's own terms and conditions sent with the proposal behind a private link. Only that proposal's file. */
export async function GET(request: Request, ctx: RouteContext<"/api/proposal/[token]/terms">) {
  return answer(async () => {
    const { token } = await ctx.params;
    if (!allow(request, "proposal-terms", 120)) return new Response(null, { status: 429 });
    const file = /^[a-f0-9]{48}$/.test(token) ? await publicTerms(token) : null;
    return file ? termsResponse(file, file.name) : new Response(null, { status: 404 });
  });
}
