import { HEALTH_ITEMS, isHealthItem } from "@/lib/domain/home-health";
import { dbConfigured } from "@/lib/server/db";
import { addHealthQuote, healthRecord } from "@/lib/server/home-health-repo";
import { addNote, contactIdByEmail, crmNote } from "@/lib/server/hubspot-crm";
import { allow } from "@/lib/server/rate-limit";

/** POST { id, item }: "Add to my plan — we'll quote it" on a saved Home Health check (the check's private id is the proof). */
export async function POST(request: Request) {
  if (!allow(request, "home-health-quote", 60)) return Response.json({ ok: false }, { status: 429 });
  if (!dbConfigured()) return Response.json({ ok: false }, { status: 503 });
  let body: { id?: unknown; item?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false }, { status: 400 });
  }
  if (typeof body.id !== "string" || !/^hh_[a-f0-9]{24}$/.test(body.id) || !isHealthItem(body.item)) {
    return Response.json({ ok: false }, { status: 400 });
  }
  const record = await healthRecord(body.id);
  if (!record) return Response.json({ ok: false }, { status: 404 });
  const added = await addHealthQuote(record, body.item);
  const token = process.env.HUBSPOT_PRIVATE_APP_TOKEN?.trim();
  if (added && token && record.email) {
    try {
      await addNote(
        await contactIdByEmail(record.email, token),
        crmNote("Healthy home quote request", {
          Item: HEALTH_ITEMS[body.item],
          Order: record.job_reference ?? "No reservation yet",
          "Follow up": "Before the install date, so it can go in on the same visit",
        }),
        token,
      );
    } catch (e) {
      console.error("quote request not noted in HubSpot", e instanceof Error ? e.message : e);
    }
  }
  return Response.json({ ok: true });
}
