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
    const file = /^[a-f0-9]{48}$/.test(token) ? await publicDatasheet(token, id) : null;
    if (!file) return new Response("Not found", { status: 404 });
    const name = file.fileName || `datasheet${file.type === "application/pdf" ? ".pdf" : ""}`;
    return new Response(new Uint8Array(file.bytes), {
      headers: {
        "content-type": file.type,
        "content-disposition": `inline; filename*=UTF-8''${encodeURIComponent(name)}`,
        "cache-control": "private, max-age=3600",
        "x-content-type-options": "nosniff",
        "x-robots-tag": "noindex, nofollow",
        "referrer-policy": "no-referrer",
        "content-security-policy": "sandbox; default-src 'none'; img-src 'self'",
      },
    });
  });
}
