/**
 * Server only. Sends each reservation to HubSpot: creates or updates the
 * contact, then attaches a note with the system, install date and ad source.
 * Uses a HubSpot private app token (HUBSPOT_PRIVATE_APP_TOKEN) with the
 * crm.objects.contacts.write scope.
 */
import type { ContactDetails } from "@/lib/domain/contact";

const API = "https://api.hubapi.com/crm/v3/objects";

export class HubspotError extends Error {}

async function call(path: string, token: string, method: "POST" | "PATCH", body: unknown) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15_000),
  });
  return res;
}

/** Creates the contact, or updates it when that email already exists. Returns the contact id. */
export async function upsertContact(contact: ContactDetails, token: string): Promise<string> {
  const properties = {
    email: contact.email,
    firstname: contact.firstName,
    lastname: contact.lastName,
    mobilephone: contact.mobile,
    phone: contact.mobile,
    lifecyclestage: "lead",
  };
  let res = await call("/contacts", token, "POST", { properties });
  if (res.status === 409) {
    // Existing contact: update it (lifecycle stage can't move backwards, so leave it out).
    const { lifecyclestage: _stage, ...rest } = properties; // eslint-disable-line @typescript-eslint/no-unused-vars
    res = await call(`/contacts/${encodeURIComponent(contact.email)}?idProperty=email`, token, "PATCH", { properties: rest });
  }
  if (!res.ok) throw new HubspotError(`HubSpot contact ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const json = (await res.json()) as { id?: string };
  if (!json.id) throw new HubspotError("HubSpot returned no contact id");
  return json.id;
}

/** Adds a note to the contact's timeline (note → contact association type 202). */
export async function addNote(contactId: string, html: string, token: string): Promise<void> {
  const res = await call("/notes", token, "POST", {
    properties: { hs_timestamp: new Date().toISOString(), hs_note_body: html },
    associations: [{ to: { id: contactId }, types: [{ associationCategory: "HUBSPOT_DEFINED", associationTypeId: 202 }] }],
  });
  if (!res.ok) throw new HubspotError(`HubSpot note ${res.status}: ${(await res.text()).slice(0, 300)}`);
}

const escape = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

/** Note body: one line per detail, escaped. */
export function reservationNote(reference: string, details: Record<string, string | undefined>): string {
  const rows = Object.entries(details)
    .filter(([, v]) => v)
    .map(([k, v]) => `<strong>${escape(k)}:</strong> ${escape(v!)}`);
  return [`<strong>RENUABL reservation ${escape(reference)}</strong>`, ...rows].join("<br>");
}
