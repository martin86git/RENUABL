import { cleanAddOnKey } from "@/lib/domain/design/add-ons";
import { currentSession } from "@/lib/server/accounts";
import { attachNumber } from "@/lib/server/business-numbers";
import { dbConfigured } from "@/lib/server/db";
import { endAddOn, switchOn } from "@/lib/server/design-addons";

/**
 * POST (staff) { businessId, key, do: "on" | "end" } → an add-on switched on for a business once its price is agreed
 * (domain/design/add-ons.ts), or ended (voice ending releases the number); { businessId, do: "number", e164, vapiId } →
 * a number staff set up by hand (bought in Twilio, imported into Vapi) put on the business while buying from the app is off.
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
  if (!businessId) return Response.json({ ok: false, message: "Which business?" }, { status: 400 });
  if (body.do === "number") {
    const done = await attachNumber(businessId, {
      e164: typeof body.e164 === "string" ? body.e164 : "",
      vapiId: typeof body.vapiId === "string" ? body.vapiId : null,
      by: session.email,
    });
    return done === "ok"
      ? Response.json({ ok: true })
      : Response.json({ ok: false, message: "That isn't an Australian number." }, { status: 422 });
  }
  const key = cleanAddOnKey(body.key);
  if (!key) return Response.json({ ok: false, message: "Which add-on?" }, { status: 400 });
  if (body.do === "on") await switchOn(businessId, key, session.email);
  else if (body.do === "end") await endAddOn(businessId, key);
  else return Response.json({ ok: false }, { status: 400 });
  return Response.json({ ok: true });
}
