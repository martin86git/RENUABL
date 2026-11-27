import { cleanTicketWords } from "@/lib/domain/design/support";
import { listDesignBusinesses } from "@/lib/server/design-admin-repo";
import { answer, readBody } from "@/lib/server/design-context";
import { hqLeads } from "@/lib/server/design-hq";
import { staffBehind } from "@/lib/server/design-staff-view";
import { staffReply, staffSetResolved, staffTickets } from "@/lib/server/design-support";

// Hidden from everyone but RENUABL's staff: anyone else is answered as if there were nothing here.
const nothing = () => new Response(null, { status: 404 });

/** GET (staff) → { leads, tickets, businesses }: what RENUABL admin shows (domain/design/hq.ts). */
export async function GET() {
  return answer(async () => {
    if (!(await staffBehind())) return nothing();
    const [leads, tickets, businesses] = await Promise.all([hqLeads(), staffTickets(), listDesignBusinesses()]);
    return Response.json({ ok: true, leads, tickets, businesses });
  });
}

/**
 * POST (staff) { id, do: "reply", text, resolve? } | { id, do: "resolve" | "reopen" }: RENUABL answers a business's
 * support ticket, as /api/admin/support does. A reply emails the person who raised it.
 */
export async function POST(request: Request) {
  return answer(async () => {
    const staff = await staffBehind();
    if (!staff) return nothing();
    const read = await readBody(request, 8000);
    if ("refuse" in read) return read.refuse;
    const { body } = read;
    const id = typeof body.id === "string" && /^st_[0-9a-f]{20}$/.test(body.id) ? body.id : null;
    if (!id) return Response.json({ ok: false, message: "Which ticket?" }, { status: 400 });
    const gone = () => Response.json({ ok: false, message: "No such ticket." }, { status: 404 });
    if (body.do === "reply") {
      const text = cleanTicketWords(body.text);
      if (!text) return Response.json({ ok: false, message: "Write the reply first." }, { status: 422 });
      const done = await staffReply(id, staff, text, body.resolve === true);
      return done ? Response.json({ ok: true, emailed: done === "emailed" }) : gone();
    }
    if (body.do === "resolve" || body.do === "reopen")
      return (await staffSetResolved(id, body.do === "resolve")) ? Response.json({ ok: true }) : gone();
    return Response.json({ ok: false, message: "That isn't something a ticket does." }, { status: 400 });
  });
}
