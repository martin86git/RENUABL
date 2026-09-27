import { PREVIEW_MODE } from "@/lib/config";
import { cleanHandoverUpdate, emptyHandover } from "@/lib/domain/handover";
import { getRecord, saveRecord, validKey } from "@/lib/server/handover-store";
import { storageConfigured } from "@/lib/server/storage";

/** GET the job's installation record (for the partner portal and the customer's My RENUABL). */
export async function GET(_: Request, ctx: RouteContext<"/api/jobs/[key]/handover">) {
  const { key } = await ctx.params;
  if (!validKey(key)) return Response.json({ ok: false }, { status: 404 });
  // 200, not an error: the portal then keeps the handover on the device.
  if (!storageConfigured()) return Response.json({ ok: false, notConfigured: true });
  const record = await getRecord(key);
  return record ? Response.json({ ok: true, record }) : Response.json({ ok: false }, { status: 404 });
}

/**
 * PUT { jobReference, arrays, serials, submit?, summary? } from the partner
 * portal. Only while the portal runs in preview (it has no partner logins yet).
 */
export async function PUT(request: Request, ctx: RouteContext<"/api/jobs/[key]/handover">) {
  const { key } = await ctx.params;
  if (!validKey(key) || !PREVIEW_MODE) return Response.json({ ok: false }, { status: 404 });
  if (!storageConfigured()) return Response.json({ ok: false, notConfigured: true }, { status: 503 });
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false }, { status: 400 });
  }
  const update = cleanHandoverUpdate(body);
  if (!update) return Response.json({ ok: false }, { status: 400 });
  const reference = typeof body.jobReference === "string" ? body.jobReference.slice(0, 20) : "";
  const existing = (await getRecord(key)) ?? emptyHandover(key, reference);
  const s = (body.summary ?? {}) as Record<string, unknown>;
  const text = (v: unknown) => (typeof v === "string" ? v.slice(0, 160) : undefined);
  const record = await saveRecord({
    ...existing,
    ...update,
    summary: { address: text(s.address), system: text(s.system), installer: text(s.installer), installedOn: text(s.installedOn) },
    submittedAt: body.submit === true ? new Date().toISOString() : existing.submittedAt,
  });
  return Response.json({ ok: true, record });
}
