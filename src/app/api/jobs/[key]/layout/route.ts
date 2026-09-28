import { cleanLayout, layoutArrays } from "@/lib/domain/roof-layout";
import { validKey } from "@/lib/server/handover-store";
import { roofData } from "@/lib/server/google-solar";
import { jobLayoutByRecord, saveJobLayout } from "@/lib/server/jobs-repo";
import { portalContext } from "@/lib/server/portal";

/** PUT { slots: number[] }: the job's own partner saves its panel layout (spots from Google's roof model). */
export async function PUT(request: Request, ctx: RouteContext<"/api/jobs/[key]/layout">) {
  const { key } = await ctx.params;
  if (!validKey(key)) return Response.json({ ok: false }, { status: 404 });
  const portal = await portalContext();
  if (portal?.kind !== "partner") return Response.json({ ok: false }, { status: 401 });
  let body: { slots?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false }, { status: 400 });
  }
  const job = await jobLayoutByRecord(key);
  if (!job || typeof job.address.lat !== "number" || typeof job.address.lng !== "number")
    return Response.json({ ok: false }, { status: 404 });
  const model = (await roofData(job.address.lat, job.address.lng))?.model;
  if (!model) return Response.json({ ok: false, message: "There's no roof model for this home." }, { status: 404 });
  const slots = cleanLayout(body.slots, model.slots.length);
  if (!slots) return Response.json({ ok: false }, { status: 400 });
  const saved = await saveJobLayout(portal.partner.id, key, { slots, arrays: layoutArrays(model, slots) });
  return saved ? Response.json({ ok: true, arrays: layoutArrays(model, slots) }) : Response.json({ ok: false }, { status: 403 });
}
