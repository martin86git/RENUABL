import { cleanPlan, planArrays } from "@/lib/domain/panel-plan";
import { validKey } from "@/lib/server/handover-store";
import { jobLayoutByRecord, saveJobLayout } from "@/lib/server/jobs-repo";
import { portalContext } from "@/lib/server/portal";

/** PUT { panels: [{ lat, lng, rotation }] }: the job's own partner saves the panels they placed. */
export async function PUT(request: Request, ctx: RouteContext<"/api/jobs/[key]/layout">) {
  const { key } = await ctx.params;
  if (!validKey(key)) return Response.json({ ok: false }, { status: 404 });
  const portal = await portalContext();
  if (portal?.kind !== "partner") return Response.json({ ok: false }, { status: 401 });
  let body: { panels?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false }, { status: 400 });
  }
  const job = await jobLayoutByRecord(key);
  if (!job || typeof job.address.lat !== "number" || typeof job.address.lng !== "number")
    return Response.json({ ok: false }, { status: 404 });
  const panels = cleanPlan(body.panels, { lat: job.address.lat, lng: job.address.lng });
  if (!panels) return Response.json({ ok: false, message: "That layout couldn't be read. Try again." }, { status: 400 });
  const arrays = planArrays(panels);
  const saved = await saveJobLayout(portal.partner.id, key, { panels, arrays });
  return saved ? Response.json({ ok: true, arrays }) : Response.json({ ok: false }, { status: 403 });
}
