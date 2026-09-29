import { buildIcs, callEvent } from "@/lib/domain/calendar";
import { formatCallTime } from "@/lib/domain/booking";
import { callBookedEmail, plainText } from "@/lib/domain/emails";
import { formatDate } from "@/lib/domain/format";
import { LAUNCH_MARKET } from "@/lib/domain/market";
import { parseReference } from "@/lib/domain/deposit";
import { sendEmail } from "@/lib/server/email";
import { addNote, contactIdByEmail, reservationNote } from "@/lib/server/hubspot-crm";

/** POST { reference, email, firstName, date, time, label } → books the confirmation call (in-app calendar). */
export async function POST(request: Request) {
  let b: Record<string, unknown>;
  try {
    b = await request.json();
  } catch {
    return Response.json({ ok: false }, { status: 400 });
  }
  const reference = parseReference(typeof b.reference === "string" ? b.reference : null);
  const email = typeof b.email === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(b.email) ? b.email : null;
  const date = typeof b.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(b.date) ? b.date : null;
  const time = typeof b.time === "string" && /^\d{2}:\d{2}$/.test(b.time) ? b.time : null;
  const firstName = plainText(b.firstName, 40);
  if (!reference || !date || !time) return Response.json({ ok: false }, { status: 400 });
  // Built here rather than trusted from the browser: "Tuesday 13 October at 10:30am (Melbourne time)".
  const label = `${formatDate(date, { weekday: "long", day: "numeric", month: "long" })} at ${formatCallTime(time)} (${LAUNCH_MARKET.capital} time)`;

  const token = process.env.HUBSPOT_PRIVATE_APP_TOKEN?.trim();
  try {
    if (token && email) {
      const id = await contactIdByEmail(email, token);
      await addNote(
        id,
        reservationNote(reference, { [b.changed === true ? "Confirmation call moved to" : "Confirmation call booked"]: label }),
        token,
      );
    } else {
      console.warn(`call booked ${reference} ${label} (HubSpot not configured)`);
    }
    if (email) {
      const ics = buildIcs([callEvent({ reference, date, time })]);
      await sendEmail({
        to: email,
        ...callBookedEmail({ reference, firstName, call: label, changed: b.changed === true }),
        attachments: [{ filename: "renuabl-call.ics", content: ics, contentType: "text/calendar" }],
      });
    }
  } catch (e) {
    console.error(`call booking ${reference} follow-up failed`, e instanceof Error ? e.message : e);
  }
  return Response.json({ ok: true });
}
