import { validateContact } from "@/lib/domain/contact";
import { PREVIEW_MODE } from "@/lib/config";
import { formatCallTime } from "@/lib/domain/booking";
import { buildIcs, callEvent, installEvent } from "@/lib/domain/calendar";
import { formatDate } from "@/lib/domain/format";
import { CONSENT_MISSING, consentRecord, readConsent } from "@/lib/domain/legal";
import { LAUNCH_MARKET } from "@/lib/domain/market";
import { cleanOrder, orderConfirmationEmail, plainText } from "@/lib/domain/emails";
import { cleanJobRequest } from "@/lib/domain/jobs";
import { dbConfigured } from "@/lib/server/db";
import { sendEmail } from "@/lib/server/email";
import { createJob, referenceTaken } from "@/lib/server/jobs-repo";
import { alertNewLead } from "@/lib/server/lead-alert";
import { offerNext } from "@/lib/server/offers-engine";
import { addNote, reservationNote, upsertContact } from "@/lib/server/hubspot-crm";

/**
 * POST a reservation: { contact, details, order, installDate, job }. Nothing is
 * charged: the deposit is taken after the confirmation call. The lead goes to
 * HubSpot when HUBSPOT_PRIVATE_APP_TOKEN is set; with the database, the job is
 * saved and offered to the best installation partner (24 hours to accept).
 */
export async function POST(request: Request) {
  let body: {
    contact?: Record<string, unknown>;
    details?: Record<string, unknown>;
    consent?: unknown;
    order?: unknown;
    installDate?: string;
    job?: unknown;
    call?: unknown;
  };
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false, message: "Something went wrong. Please try again." }, { status: 400 });
  }

  const checked = validateContact(body.contact ?? {});
  if ("errors" in checked) return Response.json({ ok: false, errors: checked.errors }, { status: 422 });
  // The required box: Terms, Privacy and contact about their plan. Marketing is separate and optional.
  const consent = readConsent(body.consent);
  if (!consent.accepted) return Response.json({ ok: false, consent: true, message: CONSENT_MISSING }, { status: 422 });

  const details: Record<string, string> = {};
  for (const [k, v] of Object.entries(body.details ?? {})) {
    if (typeof v === "string" && v.trim()) details[k.slice(0, 60)] = v.trim().slice(0, 300);
  }
  // The 15-minute call is booked before reserving (in-app calendar): its label is built here, not taken from the browser.
  const call = cleanCall(body.call);
  if (call) details["Confirmation call booked"] = call.label;
  details.Consent = consentRecord({ kind: "reserve", marketing: consent.marketing, at: new Date(), timeZone: LAUNCH_MARKET.timeZone });
  const reservationId = await newReference();
  await saveJob(reservationId, checked.contact, body.job);
  // Straight to RENUABL's inbox too, whatever happens with HubSpot.
  await alertNewLead({
    kind: "reservation",
    reference: reservationId,
    name: `${checked.contact.firstName} ${checked.contact.lastName}`,
    email: checked.contact.email,
    mobile: checked.contact.mobile,
    details,
  });
  const email = () => confirmationEmail(reservationId, checked.contact, body.order, body.installDate, call);

  const token = process.env.HUBSPOT_PRIVATE_APP_TOKEN?.trim();
  if (!token) {
    // No CRM yet: keep the lead in the logs rather than lose it.
    console.warn(`reservation ${reservationId} (HubSpot not configured)`, JSON.stringify({ contact: checked.contact, details }));
    const emailed = await email();
    return Response.json({ ok: true, reservationId, emailed });
  }

  try {
    const contactId = await upsertContact(checked.contact, token);
    await addNote(contactId, reservationNote(reservationId, details), token);
    const emailed = await email();
    return Response.json({ ok: true, reservationId, emailed });
  } catch (e) {
    console.error(
      `reservation ${reservationId} failed to reach HubSpot`,
      e instanceof Error ? e.message : e,
      JSON.stringify({ contact: checked.contact, details }),
    );
    const message = "We couldn't save your reservation just now. Please try again in a moment.";
    return Response.json(
      { ok: false, message: PREVIEW_MODE && e instanceof Error ? `${message} (Preview detail: ${e.message.slice(0, 200)})` : message },
      { status: 502 },
    );
  }
}

/** The order confirmation with the install day as a calendar attachment. Never blocks the reservation. */
async function confirmationEmail(
  reference: string,
  contact: { email: string; firstName: string },
  rawOrder: unknown,
  installDate: string | undefined,
  call: { date: string; time: string; label: string } | null,
): Promise<boolean> {
  const order = cleanOrder(rawOrder);
  if (!order) return false;
  try {
    const mail = orderConfirmationEmail({
      ...order,
      call: call?.label,
      reference,
      firstName: plainText(contact.firstName, 40) || "there",
    });
    const events = [
      ...(installDate && /^\d{4}-\d{2}-\d{2}$/.test(installDate)
        ? [installEvent({ reference, date: installDate, installer: order.installer, address: order.address })]
        : []),
      ...(call ? [callEvent({ reference, date: call.date, time: call.time })] : []),
    ];
    const ics = events.length ? buildIcs(events) : null;
    const sent = await sendEmail({
      to: contact.email,
      ...mail,
      attachments: ics ? [{ filename: "renuabl-installation.ics", content: ics, contentType: "text/calendar" }] : undefined,
    });
    return sent === "sent";
  } catch (e) {
    console.error(`reservation ${reference} confirmation email failed`, e instanceof Error ? e.message : e);
    return false;
  }
}

/** { date, time } of the booked call → with the label built on the server ("Tuesday 13 October at 10:30am (Melbourne time)"). */
function cleanCall(raw: unknown): { date: string; time: string; label: string } | null {
  const c = (raw ?? {}) as { date?: unknown; time?: unknown };
  const date = typeof c.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(c.date) ? c.date : null;
  const time = typeof c.time === "string" && /^\d{2}:\d{2}$/.test(c.time) ? c.time : null;
  if (!date || !time) return null;
  return {
    date,
    time,
    label: `${formatDate(date, { weekday: "long", day: "numeric", month: "long" })} at ${formatCallTime(time)} (${LAUNCH_MARKET.capital} time)`,
  };
}

/** RN-1234; with the database, one no other job has. */
async function newReference(): Promise<string> {
  const make = (digits: number) => `RN-${Math.floor(10 ** (digits - 1) + Math.random() * 9 * 10 ** (digits - 1))}`;
  if (!dbConfigured()) return make(4);
  try {
    for (let i = 0; i < 6; i++) {
      const ref = make(i < 3 ? 4 : 6);
      if (!(await referenceTaken(ref))) return ref;
    }
  } catch (e) {
    console.error("reference check failed", e instanceof Error ? e.message : e);
  }
  return make(6);
}

/** Saves the job and offers it to a partner. Never blocks the reservation: staff can place it by hand. */
async function saveJob(
  reference: string,
  contact: { firstName: string; lastName: string; mobile: string; email: string },
  rawJob: unknown,
) {
  if (!dbConfigured()) return;
  const req = cleanJobRequest(rawJob);
  if (!req) {
    console.warn(`reservation ${reference}: no usable job details, not offered`);
    return;
  }
  try {
    const job = await createJob(
      reference,
      { name: `${contact.firstName} ${contact.lastName}`.trim(), phone: contact.mobile, email: contact.email },
      req,
    );
    await offerNext(job.id);
  } catch (e) {
    console.error(`reservation ${reference}: job not saved`, e instanceof Error ? e.message : e);
  }
}
