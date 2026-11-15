/**
 * Server only. A business's marketing contacts and lists in RENUABL Business (domain/marketing/contacts.ts), under the
 * tenant rule: every function takes the business id first and filters by it; that id only ever comes from the
 * signed-in member (requireMember), never from the browser.
 */
import { mobileOf, type ConsentKind, type ContactInput, type MarketingContact, type MarketingList } from "@/lib/domain/marketing/contacts";
import { newId, query, randomToken, transaction } from "./db";

const moment = (column: string) => `to_char(${column} at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')`;

const CONTACT_COLUMNS = `c.id, c.email, c.first_name as "firstName", c.last_name as "lastName", c.company, c.mobile, c.phone, c.website, c.state,
  c.postcode, c.role, c.source, c.consent, c.consent_note as "consentNote", ${moment("c.created_at")} as "createdAt",
  ${moment("c.unsubscribed_at")} as "unsubscribedAt", ${moment("c.bounced_at")} as "bouncedAt",
  coalesce((select array_agg(m.list_id order by m.added_at) from design_marketing_list_members m where m.contact_id = c.id), '{}') as lists`;

/** Contacts who may be emailed: the SQL twin of `mayEmail`. */
export const EMAILABLE = `c.consent in ('express','inferred') and c.unsubscribed_at is null and c.bounced_at is null`;

export interface ImportResult {
  added: number;
  updated: number;
}

interface ImportMeta {
  fileName: string;
  source: string;
  consent: ConsentKind;
  consentNote: string | null;
  listId: string | null;
  by: string;
  skipped: number;
  /** Emails that unsubscribed elsewhere in the business (its group emails): kept unsubscribed here too. */
  unsubscribed?: readonly string[];
}

/**
 * Adds the contacts, one per email in the business. A contact already held keeps what it has and only gains blanks;
 * its consent changes only from "not checked" to what this import says, or to "none" (a no always wins). An
 * unsubscribe is never undone by an import.
 */
export async function importContacts(businessId: string, contacts: ContactInput[], meta: ImportMeta): Promise<ImportResult> {
  return transaction(async (q) => {
    const importId = newId("mi");
    const ids: string[] = [];
    let added = 0;
    let updated = 0;
    const takesConsent = `excluded.consent = 'none' or design_marketing_contacts.consent = 'unknown'`;
    for (let i = 0; i < contacts.length; i += 500) {
      const chunk = contacts.slice(i, i + 500).map((c) => ({ ...c, id: newId("mc"), token: randomToken(20) }));
      const rows = await q<{ id: string; inserted: boolean }>(
        `insert into design_marketing_contacts (id, business_id, email, first_name, last_name, company, mobile, phone, website, state, postcode, role,
                                                source, consent, consent_note, consent_by, consent_at, unsub_token, created_by)
         select r.id, $2, r.email, r."firstName", r."lastName", r.company, r.mobile, r.phone, r.website, r.state, r.postcode, r.role,
                $3, $4, $5, $6, now(), r.token, $6
           from jsonb_to_recordset($1::jsonb) as r(id text, email text, "firstName" text, "lastName" text, company text, mobile text, phone text,
                                                   website text, state text, postcode text, role text, token text)
         on conflict (business_id, email) do update set
           first_name = coalesce(design_marketing_contacts.first_name, excluded.first_name),
           last_name = coalesce(design_marketing_contacts.last_name, excluded.last_name),
           company = coalesce(design_marketing_contacts.company, excluded.company),
           mobile = coalesce(design_marketing_contacts.mobile, excluded.mobile),
           phone = coalesce(design_marketing_contacts.phone, excluded.phone),
           website = coalesce(design_marketing_contacts.website, excluded.website),
           state = coalesce(design_marketing_contacts.state, excluded.state),
           postcode = coalesce(design_marketing_contacts.postcode, excluded.postcode),
           role = coalesce(design_marketing_contacts.role, excluded.role),
           consent = case when ${takesConsent} then excluded.consent else design_marketing_contacts.consent end,
           consent_note = case when ${takesConsent} then excluded.consent_note else design_marketing_contacts.consent_note end,
           consent_by = case when ${takesConsent} then excluded.consent_by else design_marketing_contacts.consent_by end,
           consent_at = case when ${takesConsent} then now() else design_marketing_contacts.consent_at end,
           updated_at = now()
         returning id, (xmax = 0) as inserted`,
        [JSON.stringify(chunk), businessId, meta.source, meta.consent, meta.consentNote, meta.by.toLowerCase()],
      );
      for (const r of rows) {
        ids.push(r.id);
        if (r.inserted) added++;
        else updated++;
      }
      if (meta.listId && rows.length) {
        await q(
          `insert into design_marketing_list_members (business_id, list_id, contact_id)
           select $1, $2, unnest($3::text[]) on conflict do nothing`,
          [businessId, meta.listId, rows.map((r) => r.id)],
        );
      }
    }
    if (meta.unsubscribed?.length)
      await q(
        `update design_marketing_contacts set unsubscribed_at = coalesce(unsubscribed_at, now())
          where business_id = $1 and email = any($2::text[])`,
        [businessId, meta.unsubscribed],
      );
    await q(
      `insert into design_marketing_imports (id, business_id, file_name, source, consent, consent_note, list_id, added, updated, skipped, by_email)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
      [
        importId,
        businessId,
        meta.fileName.slice(0, 200),
        meta.source,
        meta.consent,
        meta.consentNote,
        meta.listId,
        added,
        updated,
        meta.skipped,
        meta.by.toLowerCase(),
      ],
    );
    for (let i = 0; i < ids.length; i += 1000)
      await q(
        `insert into design_marketing_import_members (business_id, import_id, contact_id)
         select $1, $2, unnest($3::text[]) on conflict do nothing`,
        [businessId, importId, ids.slice(i, i + 1000)],
      );
    return { added, updated };
  });
}

export interface CrmPerson extends ContactInput {
  unsubscribed: boolean;
}

/** The business's own CRM customers with an email (not the made-up samples), to bring into its marketing contacts. */
export async function crmPeople(businessId: string): Promise<CrmPerson[]> {
  const rows = await query<{ email: string; first: string; last: string; name: string; phone: string; unsub: boolean }>(
    `select lower(trim(email)) as email, first_name as first, last_name as last, name, phone, unsubscribed_at is not null as unsub
       from design_customers where business_id = $1 and email <> '' and not sample`,
    [businessId],
  );
  const seen = new Set<string>();
  const out: CrmPerson[] = [];
  for (const r of rows) {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(r.email) || seen.has(r.email)) continue;
    seen.add(r.email);
    const [first, ...rest] = (r.name ?? "").trim().split(/\s+/);
    out.push({
      email: r.email,
      firstName: r.first || first || null,
      lastName: r.last || rest.join(" ") || null,
      company: null,
      mobile: mobileOf(r.phone),
      phone: r.phone && !mobileOf(r.phone) ? r.phone : null,
      website: null,
      state: null,
      postcode: null,
      role: null,
      unsubscribed: r.unsub,
    });
  }
  return out;
}

export interface ContactPage {
  contacts: MarketingContact[];
  total: number;
}

/** Contacts by search (every word in the email, name, company, state or source) and list, newest first. */
export async function listContacts(
  businessId: string,
  opts: { search?: string; listId?: string | null; importId?: string | null; offset?: number; limit?: number },
): Promise<ContactPage> {
  const words = (opts.search ?? "").toLowerCase().split(/\s+/).filter(Boolean).slice(0, 6);
  const params: unknown[] = [businessId];
  const where: string[] = ["c.business_id = $1"];
  for (const w of words) {
    params.push(`%${w.replace(/[\\%_]/g, (m) => `\\${m}`)}%`);
    where.push(
      `lower(concat_ws(' ', c.email, c.first_name, c.last_name, c.company, c.state, c.source, c.role, c.mobile, c.phone)) like $${params.length}`,
    );
  }
  if (opts.listId) {
    params.push(opts.listId);
    where.push(`exists (select 1 from design_marketing_list_members m where m.contact_id = c.id and m.list_id = $${params.length})`);
  }
  if (opts.importId) {
    params.push(opts.importId);
    where.push(`exists (select 1 from design_marketing_import_members i where i.contact_id = c.id and i.import_id = $${params.length})`);
  }
  const clause = `where ${where.join(" and ")}`;
  const limit = Math.min(Math.max(opts.limit ?? 50, 1), 200);
  const offset = Math.max(opts.offset ?? 0, 0);
  const [rows, count] = await Promise.all([
    query<MarketingContact>(
      `select ${CONTACT_COLUMNS} from design_marketing_contacts c ${clause} order by c.created_at desc, c.email limit ${limit} offset ${offset}`,
      params,
    ),
    query<{ n: number }>(`select count(*)::int as n from design_marketing_contacts c ${clause}`, params),
  ]);
  return { contacts: rows, total: count[0]?.n ?? 0 };
}

export interface ContactCounts {
  total: number;
  emailable: number;
  unknown: number;
  unsubscribed: number;
  bounced: number;
}

export async function contactCounts(businessId: string): Promise<ContactCounts> {
  const rows = await query<ContactCounts>(
    `select count(*)::int as total,
            count(*) filter (where ${EMAILABLE})::int as emailable,
            count(*) filter (where c.consent = 'unknown')::int as unknown,
            count(*) filter (where c.unsubscribed_at is not null)::int as unsubscribed,
            count(*) filter (where c.bounced_at is not null)::int as bounced
       from design_marketing_contacts c where c.business_id = $1`,
    [businessId],
  );
  return rows[0] ?? { total: 0, emailable: 0, unknown: 0, unsubscribed: 0, bounced: 0 };
}

export async function listLists(businessId: string): Promise<MarketingList[]> {
  return query<MarketingList>(
    `select l.id, l.name,
            (select count(*)::int from design_marketing_list_members m where m.list_id = l.id) as members,
            (select count(*)::int from design_marketing_list_members m join design_marketing_contacts c on c.id = m.contact_id
              where m.list_id = l.id and ${EMAILABLE}) as emailable
       from design_marketing_lists l where l.business_id = $1 order by l.created_at desc`,
    [businessId],
  );
}

/** A list of the business's by its name, made if there isn't one. */
export async function listNamed(businessId: string, name: string, by: string): Promise<string> {
  const rows = await query<{ id: string }>(
    `insert into design_marketing_lists (id, business_id, name, created_by) values ($1,$2,$3,$4)
     on conflict (business_id, name) do update set name = excluded.name returning id`,
    [newId("ml"), businessId, name, by.toLowerCase()],
  );
  return rows[0].id;
}

export async function renameList(businessId: string, id: string, name: string): Promise<boolean> {
  return (
    (await query(`update design_marketing_lists set name = $3 where business_id = $1 and id = $2 returning id`, [businessId, id, name]))
      .length > 0
  );
}

/** Removes the list (its contacts stay). */
export async function deleteList(businessId: string, id: string): Promise<boolean> {
  return (await query(`delete from design_marketing_lists where business_id = $1 and id = $2 returning id`, [businessId, id])).length > 0;
}

export async function addToList(businessId: string, listId: string, contactIds: string[]): Promise<number> {
  const rows = await query(
    `insert into design_marketing_list_members (business_id, list_id, contact_id)
     select $1, $2, c.id from design_marketing_contacts c
      where c.business_id = $1 and c.id = any($3::text[])
        and exists (select 1 from design_marketing_lists l where l.business_id = $1 and l.id = $2)
     on conflict do nothing returning contact_id`,
    [businessId, listId, contactIds.slice(0, 1000)],
  );
  return rows.length;
}

export async function removeFromList(businessId: string, listId: string, contactIds: string[]): Promise<number> {
  const rows = await query(
    `delete from design_marketing_list_members where business_id = $1 and list_id = $2 and contact_id = any($3::text[]) returning contact_id`,
    [businessId, listId, contactIds.slice(0, 1000)],
  );
  return rows.length;
}

/** Records consent for contacts by hand, with how the business knows. */
export async function setConsent(
  businessId: string,
  contactIds: string[],
  consent: ConsentKind,
  note: string | null,
  by: string,
): Promise<number> {
  const rows = await query(
    `update design_marketing_contacts set consent = $3, consent_note = $4, consent_by = $5, consent_at = now(), updated_at = now()
      where business_id = $1 and id = any($2::text[]) returning id`,
    [businessId, contactIds.slice(0, 1000), consent, note, by.toLowerCase()],
  );
  return rows.length;
}

/** Marks a contact unsubscribed by hand (e.g. they asked by reply). Kept for good, and for the business's group emails too. */
export async function unsubscribeContact(businessId: string, id: string): Promise<boolean> {
  const rows = await query<{ email: string }>(
    `update design_marketing_contacts set unsubscribed_at = coalesce(unsubscribed_at, now()), updated_at = now()
      where business_id = $1 and id = $2 returning email`,
    [businessId, id],
  );
  if (!rows[0]) return false;
  await stopGroupEmails(businessId, rows[0].email);
  return true;
}

/** The business's group emails (people.tsx) stop for this address too: an unsubscribe is honoured everywhere. */
export async function stopGroupEmails(businessId: string, email: string): Promise<void> {
  await query(
    `update design_customers set unsubscribed_at = coalesce(unsubscribed_at, now())
      where business_id = $1 and lower(trim(email)) = lower($2)`,
    [businessId, email],
  );
}

export interface ImportRecord {
  id: string;
  fileName: string;
  source: string;
  consent: ConsentKind;
  added: number;
  updated: number;
  skipped: number;
  by: string;
  at: string;
  /** Contacts from this file still held (0 for files imported before this was kept). */
  contacts: number;
  withMobile: number;
}

export async function listImports(businessId: string): Promise<ImportRecord[]> {
  return query<ImportRecord>(
    `select i.id, i.file_name as "fileName", i.source, i.consent, i.added, i.updated, i.skipped, i.by_email as by, ${moment("i.at")} as at,
            count(c.id)::int as contacts, count(c.mobile)::int as "withMobile"
       from design_marketing_imports i
       left join design_marketing_import_members m on m.import_id = i.id
       left join design_marketing_contacts c on c.id = m.contact_id and c.business_id = i.business_id
      where i.business_id = $1 group by i.id order by i.at desc limit 50`,
    [businessId],
  );
}

/** Renames an imported file as the business wants it shown; only the business's own. */
export async function renameImport(businessId: string, id: string, name: string): Promise<boolean> {
  const rows = await query(`update design_marketing_imports set file_name = $3 where business_id = $1 and id = $2 returning id`, [
    businessId,
    id,
    name,
  ]);
  return rows.length > 0;
}
