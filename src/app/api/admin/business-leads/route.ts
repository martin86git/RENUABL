import { cleanDemoLink, cleanDemoTime, cleanStaffNote, cleanStage } from "@/lib/domain/design/business-leads";
import { currentSession } from "@/lib/server/accounts";
import { bookDemo, moveBusinessLead, noteBusinessLead } from "@/lib/server/business-leads-repo";
import { dbConfigured } from "@/lib/server/db";

/**
 * POST (staff) { id, stage } moves a lead in RENUABL Business's own pipeline; { id, note } keeps staff's note on it
 * ("" clears it); { id, demo: { date, time, link?, remindLead? } } books its demo (Melbourne's clock), moving it to Demo
 * booked with the reminders lined up for the ten-minute cron. Staff only (business-leads-repo.ts).
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
  if (body.demo && typeof body.demo === "object") {
    const d = body.demo as Record<string, unknown>;
    const time = cleanDemoTime(d.date, d.time);
    if ("problem" in time) return Response.json({ ok: false, message: time.problem }, { status: 400 });
    const link = cleanDemoLink(d.link);
    if (typeof d.link === "string" && d.link.trim() && !link)
      return Response.json({ ok: false, message: "The link to join must be a full https:// address." }, { status: 400 });
    return (await bookDemo(id, { at: time.at, link, remindLead: d.remindLead === true }, session.email))
      ? Response.json({ ok: true })
      : Response.json({ ok: false, message: "No such lead." }, { status: 404 });
  }
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
