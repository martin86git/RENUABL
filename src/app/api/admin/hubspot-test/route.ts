import { connection } from "next/server";
import { currentSession } from "@/lib/server/accounts";
import { addNote, crmNote, followUpContactId, hubspotToken } from "@/lib/server/hubspot-crm";

/** The one contact every test writes to: RENUABL's own, never anyone else's. */
const TEST_EMAIL = "website-test@renuabl.com.au";

/**
 * GET (staff, signed in): does what a website lead does in HubSpot (finds or creates a contact, then adds a
 * note) on RENUABL's own test contact, and shows each step's result with HubSpot's reply, so a lead that
 * didn't arrive can be fixed without the server logs. Open it in the browser while signed in to /admin.
 */
export async function GET() {
  await connection();
  const session = await currentSession();
  if (session?.role !== "staff") return Response.json({ ok: false, message: "Sign in at /login as staff first." }, { status: 401 });
  const token = hubspotToken();
  if (!token) return Response.json({ ok: false, step: "token", message: "No HubSpot token in Vercel." });
  let contactId: string;
  try {
    contactId = await followUpContactId({ email: TEST_EMAIL, mobile: null }, token);
  } catch (e) {
    return Response.json({ ok: false, step: "contact", message: e instanceof Error ? e.message : String(e) });
  }
  try {
    await addNote(contactId, crmNote("RENUABL website test", { Result: "If you can read this, website leads reach HubSpot." }), token);
  } catch (e) {
    return Response.json({ ok: false, step: "note", contactId, message: e instanceof Error ? e.message : String(e) });
  }
  return Response.json({
    ok: true,
    contactId,
    message: `Saved: look for the contact ${TEST_EMAIL} in HubSpot, with a note "RENUABL website test".`,
  });
}
