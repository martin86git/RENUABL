import { cleanStaffNote, cleanStage } from "@/lib/domain/design/business-leads";
import { currentSession } from "@/lib/server/accounts";
import { moveBusinessLead, noteBusinessLead } from "@/lib/server/business-leads-repo";
import { dbConfigured } from "@/lib/server/db";

/**
 * POST (staff) { id, stage } moves a lead in RENUABL Business's own pipeline; { id, note } keeps staff's note on it
 * ("" clears it). Staff only (business-leads-repo.ts).
 */
export async function POST(request: Request) {
  if (!dbConfigured()) return Response.json({ ok: false }, { status: 404 });
  const session = await currentSession();
  if (session?.role !== "staff") return Response.json({ ok: false }, { status: 401 });
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return Response.json({ ok: false }, { status: 400 });
  }
  const id = typeof body.id === "string" && /^[\w-]{4,80}$/.test(body.id) ? body.id : null;
  if (!id) return Response.json({ ok: false, message: "Which lead?" }, { status: 400 });
  if ("stage" in body) {
    const stage = cleanStage(body.stage);
    if (!stage) return Response.json({ ok: false, message: "That isn't a stage." }, { status: 400 });
    return (await moveBusinessLead(id, stage, session.email))
      ? Response.json({ ok: true })
      : Response.json({ ok: false, message: "No such lead." }, { status: 404 });
  }
  const note = cleanStaffNote(body.note);
  if (note === null) return Response.json({ ok: false, message: "Nothing to change." }, { status: 400 });
  return (await noteBusinessLead(id, note))
    ? Response.json({ ok: true })
    : Response.json({ ok: false, message: "No such lead." }, { status: 404 });
}
