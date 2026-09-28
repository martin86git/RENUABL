import { currentSession } from "@/lib/server/accounts";
import { dbConfigured } from "@/lib/server/db";
import { advancePartnerJob } from "@/lib/server/jobs-repo";

/** POST { status: "scheduled" | "in-progress" | "completed" }: the signed-in partner moves their own job on. */
export async function POST(request: Request, ctx: RouteContext<"/api/partner/jobs/[id]">) {
  const { id } = await ctx.params;
  if (!dbConfigured() || !/^job_[a-f0-9]{24}$/.test(id)) return Response.json({ ok: false }, { status: 404 });
  const session = await currentSession();
  if (session?.role !== "partner" || !session.partner) return Response.json({ ok: false }, { status: 401 });
  let body: { status?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false }, { status: 400 });
  }
  if (body.status !== "scheduled" && body.status !== "in-progress" && body.status !== "completed") {
    return Response.json({ ok: false }, { status: 400 });
  }
  const ok = await advancePartnerJob(session.partner.id, id, body.status);
  return Response.json({ ok }, { status: ok ? 200 : 409 });
}
