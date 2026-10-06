/**
 * Server only. Sends each reservation to HubSpot: creates or updates the
 * contact, then attaches a note with the system, install date and ad source.
 * Uses a HubSpot private app token (HUBSPOT_PRIVATE_APP_TOKEN) with the
 * crm.objects.contacts.write scope.
 */
import type { ContactDetails } from "@/lib/domain/contact";

const API = "https://api.hubapi.com/crm/v3/objects";

export class HubspotError extends Error {}

async function call(path: string, token: string, method: "GET" | "POST" | "PATCH", body?: unknown) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(15_000),
  });
  return res;
}

/** The contact id for an email, creating a bare contact if there isn't one. Never overwrites details. */
export async function contactIdByEmail(email: string, token: string): Promise<string> {
  let res = await call(`/contacts/${encodeURIComponent(email)}?idProperty=email`, token, "GET");
  if (res.status === 404) res = await call("/contacts", token, "POST", { properties: { email } });
  if (!res.ok) throw new HubspotError(`HubSpot contact ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const json = (await res.json()) as { id?: string };
  if (!json.id) throw new HubspotError("HubSpot returned no contact id");
  return json.id;
}

/**
 * "Don't have your bill handy?": the contact for an email and/or mobile. By email when there is one (adding the
 * mobile if HubSpot has none yet); otherwise found by mobile, or created with just the mobile.
 */
export async function followUpContactId(
  who: { email: string | null; mobile: string | null; firstName?: string },
  token: string,
): Promise<string> {
  if (who.email) {
    const id = await contactIdByEmail(who.email, token);
    if (who.mobile || who.firstName) {
      // Only fill in what HubSpot doesn't have yet: never overwrite.
      const res = await call(`/contacts/${id}?properties=mobilephone,firstname`, token, "GET");
      const json = res.ok ? ((await res.json()) as { properties?: { mobilephone?: string | null; firstname?: string | null } }) : {};
      const add: Record<string, string> = {};
      if (who.mobile && !json.properties?.mobilephone) Object.assign(add, { mobilephone: who.mobile, phone: who.mobile });
      if (who.firstName && !json.properties?.firstname) add.firstname = who.firstName;
      if (res.ok && Object.keys(add).length) await call(`/contacts/${id}`, token, "PATCH", { properties: add });
    }
    return id;
  }
  if (!who.mobile) throw new HubspotError("No email or mobile");
  const found = await call("/contacts/search", token, "POST", {
    filterGroups: [{ filters: [{ propertyName: "mobilephone", operator: "EQ", value: who.mobile }] }],
    limit: 1,
  });
  if (found.ok) {
    const json = (await found.json()) as { results?: { id?: string }[] };
    const id = json.results?.[0]?.id;
    if (id) return id;
  }
  const res = await call("/contacts", token, "POST", {
    properties: {
      mobilephone: who.mobile,
      phone: who.mobile,
      lifecyclestage: "lead",
      // A mobile-only lead has no name or email, so HubSpot would list it as a blank row: give it one to spot it by.
      firstname: who.firstName || "New lead",
      ...(who.firstName ? {} : { lastname: `(mobile ${who.mobile})` }),
    },
  });
  if (!res.ok) throw new HubspotError(`HubSpot contact ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const json = (await res.json()) as { id?: string };
  if (!json.id) throw new HubspotError("HubSpot returned no contact id");
  return json.id;
}

/** Creates the contact, or updates it when that email already exists. Returns the contact id. */
export async function upsertContact(
  contact: ContactDetails,
  token: string,
  /** Partners are "other", not sales leads; extra standard properties such as company and website. */
  opts: { lifecycle?: string; extra?: Record<string, string> } = {},
): Promise<string> {
  const properties = {
    email: contact.email,
    firstname: contact.firstName,
    lastname: contact.lastName,
    mobilephone: contact.mobile,
    phone: contact.mobile,
    ...opts.extra,
    lifecyclestage: opts.lifecycle ?? "lead",
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
  return crmNote(`RENUABL reservation ${reference}`, details);
}

/** A HubSpot note: a bold title and one "Label: value" line per detail. */
export function crmNote(title: string, details: Record<string, string | undefined>): string {
  const rows = Object.entries(details)
    .filter(([, v]) => v)
    .map(([k, v]) => `<strong>${escape(k)}:</strong> ${escape(v!)}`);
  return [`<strong>${escape(title)}</strong>`, ...rows].join("<br>");
}
