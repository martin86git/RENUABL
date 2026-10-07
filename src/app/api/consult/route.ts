import { formatCallTime, isBookableCallSlot } from "@/lib/domain/booking";
import { buildIcs, consultEvent, staffCallEvent } from "@/lib/domain/calendar";
import { validateContact } from "@/lib/domain/contact";
import { consultBookedEmail, plainText } from "@/lib/domain/emails";
import { formatDate } from "@/lib/domain/format";
import { CONSENT_MISSING, consentRecord, readConsent } from "@/lib/domain/legal";
import { LAUNCH_MARKET, todayInMarket } from "@/lib/domain/market";
import { publicSiteUrl } from "@/lib/domain/site";
import { siteUrl } from "@/lib/domain/sms";
import { sendEmail } from "@/lib/server/email";
import { addNote, crmNote, upsertContact, hubspotToken } from "@/lib/server/hubspot-crm";
import { alertNewLead } from "@/lib/server/lead-alert";
import { allow } from "@/lib/server/rate-limit";

/**
 * POST { firstName, lastName, mobile, email, date, time, source?, consent }: a prospect without a
 * reservation books a 15-minute call (/book-a-call, linked from the "finish later" email). The slot
 * is checked against the times the page offers; the label is built here. HubSpot contact + note,
 * staff alert, and the customer's email with a calendar invite. It counts as booked when it's saved
 * in HubSpot or staff were told.
 */
export async function POST(request: Request) {
  if (!allow(request, "consult", 10)) return Response.json({ ok: false, message: "Please try again later." }, { status: 429 });
  let b: Record<string, unknown>;
  try {
    b = await request.json();
  } catch {
    return Response.json({ ok: false }, { status: 400 });
  }
  const checked = validateContact(b);
  if ("errors" in checked) return Response.json({ ok: false, errors: checked.errors }, { status: 422 });
  const contact = checked.contact;
  const date = typeof b.date === "string" ? b.date : "";
  const time = typeof b.time === "string" ? b.time : "";
  if (!isBookableCallSlot(todayInMarket(), date, time))
    return Response.json({ ok: false, message: "That time isn't available any more. Please choose another." }, { status: 422 });
  const consent = readConsent(b.consent);
  if (!consent.accepted) return Response.json({ ok: false, consent: true, message: CONSENT_MISSING }, { status: 422 });

  const label = `${formatDate(date, { weekday: "long", day: "numeric", month: "long" })} at ${formatCallTime(time)} (${LAUNCH_MARKET.capital} time)`;
  const details = {
    Stage: "Booked a 15-minute call (no reservation yet)",
    Call: label,
    "Ad source": plainText(b.source, 120) || undefined,
    Consent: consentRecord({ kind: "follow-up", marketing: consent.marketing, at: new Date(), timeZone: LAUNCH_MARKET.timeZone }),
  };

  let saved = false;
  const token = hubspotToken();
  if (token) {
    try {
      const id = await upsertContact(contact, token);
      await addNote(id, crmNote(`15-minute call: ${label}`, details), token);
      saved = true;
    } catch (e) {
      console.error("call booking not saved to HubSpot", e instanceof Error ? e.message : e);
    }
  }
  if (!saved) console.warn("call booking (not in HubSpot)", JSON.stringify({ ...contact, ...details }));

  const staffIcs = buildIcs([
    staffCallEvent({
      id: `call-${date}-${time.replace(":", "")}`,
      date,
      time,
      name: `${contact.firstName} ${contact.lastName}`,
      phone: contact.mobile,
    }),
  ]);
  const alerted = await alertNewLead(
    { kind: "call", name: `${contact.firstName} ${contact.lastName}`, email: contact.email, mobile: contact.mobile, details },
    [{ filename: "renuabl-call.ics", content: staffIcs, contentType: "text/calendar" }],
  );
  if (!saved && !alerted)
    return Response.json({ ok: false, message: "We couldn't book that just now. Please try again." }, { status: 502 });

  let emailed = false;
  const site = siteUrl() ?? publicSiteUrl();
  try {
    const ics = buildIcs([consultEvent({ id: `call-${date}-${time.replace(":", "")}`, date, time })]);
    emailed =
      (await sendEmail({
        to: contact.email,
        ...consultBookedEmail({ firstName: contact.firstName, call: label, link: `${site}/` }),
        attachments: [{ filename: "renuabl-call.ics", content: ics, contentType: "text/calendar" }],
      })) === "sent";
  } catch (e) {
    console.error("call booking email failed", e instanceof Error ? e.message : e);
  }
  return Response.json({ ok: true, call: label, date, time, emailed });
}
