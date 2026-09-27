import { PREVIEW_MODE } from "@/lib/config";
import { isConnectionStep, partnerMayUpdate, updateConnection } from "@/lib/domain/connection";
import { emptyHandover } from "@/lib/domain/handover";
import { getRecord, saveRecord, validKey } from "@/lib/server/handover-store";
import { currentPartner } from "@/lib/server/partner-context";
import { storageConfigured } from "@/lib/server/storage";

/**
 * PUT { jobReference, step, done: "YYYY-MM-DD" | null, reference? } from the
 * partner portal (preview only): ticks off a grid connection or rebate step
 * the partner is responsible for.
 */
export async function PUT(request: Request, ctx: RouteContext<"/api/jobs/[key]/connection">) {
  const { key } = await ctx.params;
  if (!validKey(key) || !PREVIEW_MODE) return Response.json({ ok: false }, { status: 404 });
  if (!storageConfigured()) return Response.json({ ok: false, notConfigured: true }, { status: 503 });
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false }, { status: 400 });
  }
  const step = body.step;
  if (!isConnectionStep(step)) return Response.json({ ok: false }, { status: 400 });
  if (!partnerMayUpdate(step, currentPartner().type))
    return Response.json({ ok: false, message: "RENUABL looks after this step." }, { status: 403 });
  const reference = typeof body.jobReference === "string" ? body.jobReference.slice(0, 20) : "";
  const existing = (await getRecord(key)) ?? emptyHandover(key, reference);
  const done = typeof body.done === "string" ? body.done : null;
  const value = done ? { done, reference: typeof body.reference === "string" ? body.reference : undefined } : null;
  const connection = updateConnection(existing.connection, step, value);
  if (value && !connection[step]) return Response.json({ ok: false }, { status: 400 });
  const record = await saveRecord({ ...existing, connection });
  return Response.json({ ok: true, record });
}
