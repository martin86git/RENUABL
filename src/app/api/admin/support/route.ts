import { cleanTicketWords } from "@/lib/domain/design/support";
import { currentSession } from "@/lib/server/accounts";
import { dbConfigured } from "@/lib/server/db";
import { staffReply, staffSetResolved } from "@/lib/server/design-support";

/**
 * POST (staff) { id, do: "reply", text, resolve? } | { id, do: "resolve" | "reopen" } → RENUABL answers a business's
 * support ticket (design-support.ts). A reply emails the person who raised it.
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
  const id = typeof body.id === "string" && /^st_[0-9a-f]{20}$/.test(body.id) ? body.id : null;
  if (!id) return Response.json({ ok: false, message: "Which ticket?" }, { status: 400 });
  const gone = () => Response.json({ ok: false, message: "No such ticket." }, { status: 404 });
  if (body.do === "reply") {
    const text = cleanTicketWords(body.text);
    if (!text) return Response.json({ ok: false, message: "Write the reply first." }, { status: 422 });
    const done = await staffReply(id, session.email, text, body.resolve === true);
    return done ? Response.json({ ok: true, emailed: done === "emailed" }) : gone();
  }
  if (body.do === "resolve" || body.do === "reopen")
    return (await staffSetResolved(id, body.do === "resolve")) ? Response.json({ ok: true }) : gone();
  return Response.json({ ok: false }, { status: 400 });
}
