import { answer } from "@/lib/server/design-context";
import { publicPdfParts } from "@/lib/server/design-proposal-repo";
import { pdfName, proposalPdf } from "@/lib/server/proposal-pdf";
import { allow } from "@/lib/server/rate-limit";

/**
 * GET: the proposal behind a private link as a PDF file to keep. Made from
 * the customer's copy only, so no cost can be in it; once accepted, it
 * carries who accepted it and when.
 */
export async function GET(request: Request, ctx: RouteContext<"/api/proposal/[token]/pdf">) {
  return answer(async () => {
    const { token } = await ctx.params;
    if (!allow(request, "proposal-pdf", 30)) return new Response(null, { status: 429 });
    const parts = await publicPdfParts(token);
    if (!parts) return new Response(null, { status: 404 });
    const bytes = await proposalPdf(parts.view, parts.images, parts.accepted);
    return new Response(new Uint8Array(bytes), {
      headers: {
        "content-type": "application/pdf",
        "content-disposition": `attachment; filename="${pdfName(parts.view).replace(/[^\x20-\x7e]/g, "")}"; filename*=UTF-8''${encodeURIComponent(pdfName(parts.view))}`,
        "cache-control": "private, no-store",
        "x-robots-tag": "noindex, nofollow",
      },
    });
  });
}
