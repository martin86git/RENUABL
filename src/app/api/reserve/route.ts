import { validateContact } from "@/lib/domain/contact";
import { PREVIEW_MODE } from "@/lib/config";
import { buildIcs, installEvent } from "@/lib/domain/calendar";
import { cleanOrder, orderConfirmationEmail, plainText } from "@/lib/domain/emails";
import { sendEmail } from "@/lib/server/email";
import { addNote, reservationNote, upsertContact } from "@/lib/server/hubspot-crm";

/**
 * POST a reservation: { contact, details }. Nothing is charged: the deposit is
 * taken after the confirmation call. The lead goes to HubSpot when
 * HUBSPOT_PRIVATE_APP_TOKEN is set.
 */
export async function POST(request: Request) {
  let body: {
    contact?: Record<string, unknown>;
    details?: Record<string, unknown>;
    order?: unknown;
    installDate?: string;
  };
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false, message: "Something went wrong. Please try again." }, { status: 400 });
  }

  const checked = validateContact(body.contact ?? {});
  if ("errors" in checked) return Response.json({ ok: false, errors: checked.errors }, { status: 422 });

  const details: Record<string, string> = {};
  for (const [k, v] of Object.entries(body.details ?? {})) {
    if (typeof v === "string" && v.trim()) details[k.slice(0, 60)] = v.trim().slice(0, 300);
  }
  const reservationId = `RN-${Math.floor(1000 + Math.random() * 9000)}`;
  const email = () => confirmationEmail(reservationId, checked.contact, body.order, body.installDate);

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
): Promise<boolean> {
  const order = cleanOrder(rawOrder);
  if (!order) return false;
  try {
    const mail = orderConfirmationEmail({ ...order, reference, firstName: plainText(contact.firstName, 40) || "there" });
    const ics =
      installDate && /^\d{4}-\d{2}-\d{2}$/.test(installDate)
        ? buildIcs([installEvent({ reference, date: installDate, installer: order.installer, address: order.address })])
        : null;
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
