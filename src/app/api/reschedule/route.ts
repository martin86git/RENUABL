import { buildIcs, installEvent } from "@/lib/domain/calendar";
import { parseReference } from "@/lib/domain/deposit";
import { installMovedEmail, jobMovedEmail, plainText } from "@/lib/domain/emails";
import { siteUrl } from "@/lib/domain/sms";
import { formatDate } from "@/lib/domain/format";
import { todayInMarket } from "@/lib/domain/market";
import { INSTALL_ARRIVAL, LEAD_TIME_DAYS, isBookableInstallDate } from "@/lib/domain/scheduling";
import { dbConfigured } from "@/lib/server/db";
import { sendEmail } from "@/lib/server/email";
import { addNote, contactIdByEmail, reservationNote, hubspotToken } from "@/lib/server/hubspot-crm";
import { getJobRow, moveInstallDate } from "@/lib/server/jobs-repo";
import { getPartner } from "@/lib/server/partners-repo";
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
  // Never sooner than the lead time, a weekend or a Victorian public holiday.
  if (!isBookableInstallDate(date, todayInMarket(), LEAD_TIME_DAYS))
    return Response.json({ ok: false, message: "Please choose another weekday, at least a week away." }, { status: 422 });

  let moved: { id: string; was: string | null } | null = null;
  if (dbConfigured()) {
    try {
      moved = await moveInstallDate(reference, email, date);
      if (!moved) {
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
  const token = hubspotToken();
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
  if (moved) await tellPartner(moved.id, moved.was, date);
  return Response.json({ ok: true });
}

/** Emails the job's installation partner (once one has accepted it) about the new day. Never blocks the change. */
async function tellPartner(jobId: string, was: string | null, date: string) {
  try {
    const job = await getJobRow(jobId);
    const partner = job?.partnerId ? await getPartner(job.partnerId) : null;
    const site = siteUrl();
    if (!job || !partner || !site || was === date) return;
    const day = (d: string) => formatDate(d, { weekday: "short", day: "numeric", month: "short" });
    await sendEmail({
      to: partner.email,
      ...jobMovedEmail({
        suburb: job.address.suburb,
        reference: job.reference,
        from: was ? day(was) : null,
        to: day(date),
        link: `${site}/installer/jobs/${job.id}`,
      }),
    });
  } catch (e) {
    console.error(`reschedule ${jobId}: partner email failed`, e instanceof Error ? e.message : e);
  }
}
