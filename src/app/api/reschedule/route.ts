import { buildIcs, installEvent } from "@/lib/domain/calendar";
import { parseReference } from "@/lib/domain/deposit";
import { installMovedEmail, plainText } from "@/lib/domain/emails";
import { formatDate } from "@/lib/domain/format";
import { todayInMarket } from "@/lib/domain/market";
import { INSTALL_ARRIVAL, LEAD_TIME_DAYS, addDays, fromISODate, toISODate } from "@/lib/domain/scheduling";
import { dbConfigured } from "@/lib/server/db";
import { sendEmail } from "@/lib/server/email";
import { addNote, contactIdByEmail, reservationNote } from "@/lib/server/hubspot-crm";
import { moveInstallDate } from "@/lib/server/jobs-repo";
import { allow } from "@/lib/server/rate-limit";

/**
 * POST { reference, email, firstName, installDate }: the customer moves their
 * provisional install day from the confirmation page. With the database, only
 * their own reservation can move (reference + email must match); the job's
 * date updates, HubSpot gets a note and they're emailed a new invite.
 */
export async function POST(request: Request) {
  if (!allow(request, "reschedule", 10)) return Response.json({ ok: false, message: "Please try again later." }, { status: 429 });
  let b: Record<string, unknown>;
  try {
    b = await request.json();
  } catch {
    return Response.json({ ok: false }, { status: 400 });
  }
  const reference = parseReference(typeof b.reference === "string" ? b.reference : null);
  const email = typeof b.email === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(b.email) ? b.email.trim() : null;
  const date = typeof b.installDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(b.installDate) ? b.installDate : null;
  if (!reference || !email || !date)
    return Response.json({ ok: false, message: "Something's missing. Please try again." }, { status: 400 });
  const earliest = toISODate(addDays(fromISODate(todayInMarket()), LEAD_TIME_DAYS));
  if (date < earliest) return Response.json({ ok: false, message: "Please choose a later day." }, { status: 422 });

  if (dbConfigured()) {
    try {
      if (!(await moveInstallDate(reference, email, date))) {
        return Response.json(
          { ok: false, message: "We couldn't find that reservation. Just reply to your confirmation email." },
          { status: 404 },
        );
      }
    } catch (e) {
      console.error(`reschedule ${reference} failed`, e instanceof Error ? e.message : e);
      return Response.json({ ok: false, message: "We couldn't change it just now. Please try again." }, { status: 502 });
    }
  }

  const label = formatDate(date, { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  const token = process.env.HUBSPOT_PRIVATE_APP_TOKEN?.trim();
  try {
    if (token) {
      const id = await contactIdByEmail(email, token);
      await addNote(id, reservationNote(reference, { "Installation date moved to": label }), token);
    }
    await sendEmail({
      to: email,
      ...installMovedEmail({ reference, firstName: plainText(b.firstName, 40), installDate: label, arrival: INSTALL_ARRIVAL.label }),
      attachments: [
        { filename: "renuabl-installation.ics", content: buildIcs([installEvent({ reference, date })]), contentType: "text/calendar" },
      ],
    });
  } catch (e) {
    console.error(`reschedule ${reference} follow-up failed`, e instanceof Error ? e.message : e);
  }
  return Response.json({ ok: true });
}
