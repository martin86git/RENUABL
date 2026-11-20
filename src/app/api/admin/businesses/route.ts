import { currentSession } from "@/lib/server/accounts";
import { dbConfigured } from "@/lib/server/db";
import { setNotBilled } from "@/lib/server/design-not-billed";

/**
 * POST (staff) { businessId, notBilled: boolean } → RENUABL stops billing a business, or bills it again
 * (design-not-billed.ts): no plan step, Sol's credits and design jobs never refused, every add-on included.
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
  const businessId = typeof body.businessId === "string" && /^[\w-]{4,80}$/.test(body.businessId) ? body.businessId : null;
  if (!businessId || typeof body.notBilled !== "boolean") return Response.json({ ok: false, message: "Which business?" }, { status: 400 });
  const done = await setNotBilled(businessId, body.notBilled, session.email);
  return done ? Response.json({ ok: true }) : Response.json({ ok: false, message: "No such business." }, { status: 404 });
}
