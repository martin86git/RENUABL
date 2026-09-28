import { currentSession } from "@/lib/server/accounts";
import { dbConfigured } from "@/lib/server/db";
import { acceptOffer, declineOffer } from "@/lib/server/jobs-repo";
import { offerNext } from "@/lib/server/offers-engine";

/**
 * POST { action: "accept" | "decline" } from the signed-in partner the offer
 * was made to. Accepting within 24 hours makes the job theirs; declining (or
 * letting it lapse) offers it to the next partner.
 */
export async function POST(request: Request, ctx: RouteContext<"/api/offers/[id]">) {
  const { id } = await ctx.params;
  if (!dbConfigured() || !/^of_[a-f0-9]{24}$/.test(id)) return Response.json({ ok: false }, { status: 404 });
  const session = await currentSession();
  if (session?.role !== "partner" || !session.partner) return Response.json({ ok: false }, { status: 401 });
  let body: { action?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false }, { status: 400 });
  }
  if (body.action === "accept") {
    const jobId = await acceptOffer(id, session.partner.id);
    if (!jobId) return Response.json({ ok: false, message: "This offer has expired or was already answered." }, { status: 409 });
    return Response.json({ ok: true, jobId });
  }
  if (body.action === "decline") {
    const jobId = await declineOffer(id, session.partner.id);
    if (!jobId) return Response.json({ ok: false, message: "This offer has expired or was already answered." }, { status: 409 });
    await offerNext(jobId);
    return Response.json({ ok: true });
  }
  return Response.json({ ok: false }, { status: 400 });
}
