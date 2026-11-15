/**
 * Server only. RENUABL's own go-to-market contacts and lists (domain/marketing/contacts.ts).
 * Staff only: every caller checks the staff session first. Nothing here belongs to a business.
 */
import type { ConsentKind, ContactInput, MarketingContact, MarketingList } from "@/lib/domain/marketing/contacts";
import { newId, query, randomToken, transaction } from "./db";

const moment = (column: string) => `to_char(${column} at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')`;

const CONTACT_COLUMNS = `c.id, c.email, c.first_name as "firstName", c.last_name as "lastName", c.company, c.phone, c.website, c.state,
  c.postcode, c.role, c.source, c.consent, c.consent_note as "consentNote", ${moment("c.created_at")} as "createdAt",
  ${moment("c.unsubscribed_at")} as "unsubscribedAt", ${moment("c.bounced_at")} as "bouncedAt",
  coalesce((select array_agg(m.list_id order by m.added_at) from marketing_list_members m where m.contact_id = c.id), '{}') as lists`;

/** Contacts may be emailed: the SQL twin of `mayEmail`. */
const EMAILABLE = `c.consent in ('express','inferred') and c.unsubscribed_at is null and c.bounced_at is null`;

export interface ImportResult {
  added: number;
  updated: number;
}

/**
 * Adds the contacts, one per email. A contact already held keeps what it has and only gains blanks;
 * its consent changes only from "not checked" to what this import says, or to "none" (a no always wins).
 * An unsubscribe is never undone by an import.
 */
export async function importContacts(
  contacts: ContactInput[],
  meta: {
    fileName: string;
    source: string;
    consent: ConsentKind;
    consentNote: string | null;
    listId: string | null;
    by: string;
    skipped: number;
  },
): Promise<ImportResult> {
  return transaction(async (q) => {
    let added = 0;
    let updated = 0;
    for (let i = 0; i < contacts.length; i += 500) {
      const chunk = contacts.slice(i, i + 500).map((c) => ({ ...c, id: newId("mc"), token: randomToken(20) }));
      const rows = await q<{ id: string; inserted: boolean }>(
        `insert into marketing_contacts (id, email, first_name, last_name, company, phone, website, state, postcode, role,
                                         source, consent, consent_note, consent_by, consent_at, unsub_token, created_by)
         select r.id, r.email, r."firstName", r."lastName", r.company, r.phone, r.website, r.state, r.postcode, r.role,
                $2, $3, $4, $5, now(), r.token, $5
           from jsonb_to_recordset($1::jsonb) as r(id text, email text, "firstName" text, "lastName" text, company text, phone text,
                                                   website text, state text, postcode text, role text, token text)
         on conflict (email) do update set
           first_name = coalesce(marketing_contacts.first_name, excluded.first_name),
           last_name = coalesce(marketing_contacts.last_name, excluded.last_name),
           company = coalesce(marketing_contacts.company, excluded.company),
           phone = coalesce(marketing_contacts.phone, excluded.phone),
           website = coalesce(marketing_contacts.website, excluded.website),
           state = coalesce(marketing_contacts.state, excluded.state),
           postcode = coalesce(marketing_contacts.postcode, excluded.postcode),
           role = coalesce(marketing_contacts.role, excluded.role),
           consent = case when excluded.consent = 'none' or marketing_contacts.consent = 'unknown' then excluded.consent
                          else marketing_contacts.consent end,
           consent_note = case when excluded.consent = 'none' or marketing_contacts.consent = 'unknown' then excluded.consent_note
                               else marketing_contacts.consent_note end,
           consent_by = case when excluded.consent = 'none' or marketing_contacts.consent = 'unknown' then excluded.consent_by
                             else marketing_contacts.consent_by end,
           consent_at = case when excluded.consent = 'none' or marketing_contacts.consent = 'unknown' then now()
                             else marketing_contacts.consent_at end,
           updated_at = now()
         returning id, (xmax = 0) as inserted`,
        [JSON.stringify(chunk), meta.source, meta.consent, meta.consentNote, meta.by.toLowerCase()],
      );
      for (const r of rows) {
        if (r.inserted) added++;
        else updated++;
      }
      if (meta.listId && rows.length) {
        await q(`insert into marketing_list_members (list_id, contact_id) select $1, unnest($2::text[]) on conflict do nothing`, [
          meta.listId,
          rows.map((r) => r.id),
        ]);
      }
    }
    await q(
      `insert into marketing_imports (id, file_name, source, consent, consent_note, list_id, added, updated, skipped, by_email)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [
        newId("mi"),
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
    return { added, updated };
  });
}

export interface ContactPage {
  contacts: MarketingContact[];
  total: number;
}

/** Contacts by search (every word in the email, name, company, state or source) and list, newest first. */
export async function listContacts(opts: {
  search?: string;
  listId?: string | null;
  offset?: number;
  limit?: number;
}): Promise<ContactPage> {
  const words = (opts.search ?? "").toLowerCase().split(/\s+/).filter(Boolean).slice(0, 6);
  const params: unknown[] = [];
  const where: string[] = [];
  for (const w of words) {
    params.push(`%${w.replace(/[\\%_]/g, (m) => `\\${m}`)}%`);
    where.push(`lower(concat_ws(' ', c.email, c.first_name, c.last_name, c.company, c.state, c.source, c.role)) like $${params.length}`);
  }
  if (opts.listId) {
    params.push(opts.listId);
    where.push(`exists (select 1 from marketing_list_members m where m.contact_id = c.id and m.list_id = $${params.length})`);
  }
  const clause = where.length ? `where ${where.join(" and ")}` : "";
  const limit = Math.min(Math.max(opts.limit ?? 50, 1), 200);
  const offset = Math.max(opts.offset ?? 0, 0);
  const [rows, count] = await Promise.all([
    query<MarketingContact>(
      `select ${CONTACT_COLUMNS} from marketing_contacts c ${clause} order by c.created_at desc, c.email limit ${limit} offset ${offset}`,
      params,
    ),
    query<{ n: number }>(`select count(*)::int as n from marketing_contacts c ${clause}`, params),
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

export async function contactCounts(): Promise<ContactCounts> {
  const rows = await query<ContactCounts>(
    `select count(*)::int as total,
            count(*) filter (where ${EMAILABLE})::int as emailable,
            count(*) filter (where c.consent = 'unknown')::int as unknown,
            count(*) filter (where c.unsubscribed_at is not null)::int as unsubscribed,
            count(*) filter (where c.bounced_at is not null)::int as bounced
       from marketing_contacts c`,
  );
  return rows[0] ?? { total: 0, emailable: 0, unknown: 0, unsubscribed: 0, bounced: 0 };
}

export async function listLists(): Promise<MarketingList[]> {
  return query<MarketingList>(
    `select l.id, l.name,
            (select count(*)::int from marketing_list_members m where m.list_id = l.id) as members,
            (select count(*)::int from marketing_list_members m join marketing_contacts c on c.id = m.contact_id
              where m.list_id = l.id and ${EMAILABLE}) as emailable
       from marketing_lists l order by l.created_at desc`,
  );
}

/** A list by its name, made if there isn't one. */
export async function listNamed(name: string, by: string): Promise<string> {
  const rows = await query<{ id: string }>(
    `insert into marketing_lists (id, name, created_by) values ($1,$2,$3)
     on conflict (name) do update set name = excluded.name returning id`,
    [newId("ml"), name, by.toLowerCase()],
  );
  return rows[0].id;
}

export async function renameList(id: string, name: string): Promise<boolean> {
  return (await query(`update marketing_lists set name = $2 where id = $1 returning id`, [id, name])).length > 0;
}

/** Removes the list (its contacts stay). */
export async function deleteList(id: string): Promise<boolean> {
  return (await query(`delete from marketing_lists where id = $1 returning id`, [id])).length > 0;
}

export async function addToList(listId: string, contactIds: string[]): Promise<number> {
  const rows = await query(
    `insert into marketing_list_members (list_id, contact_id)
     select $1, c.id from marketing_contacts c where c.id = any($2::text[]) and exists (select 1 from marketing_lists l where l.id = $1)
     on conflict do nothing returning contact_id`,
    [listId, contactIds.slice(0, 1000)],
  );
  return rows.length;
}

export async function removeFromList(listId: string, contactIds: string[]): Promise<number> {
  const rows = await query(`delete from marketing_list_members where list_id = $1 and contact_id = any($2::text[]) returning contact_id`, [
    listId,
    contactIds.slice(0, 1000),
  ]);
  return rows.length;
}

/** Staff record consent for contacts by hand, with how they know. */
export async function setConsent(contactIds: string[], consent: ConsentKind, note: string | null, by: string): Promise<number> {
  const rows = await query(
    `update marketing_contacts set consent = $2, consent_note = $3, consent_by = $4, consent_at = now(), updated_at = now()
      where id = any($1::text[]) returning id`,
    [contactIds.slice(0, 1000), consent, note, by.toLowerCase()],
  );
  return rows.length;
}

/** Marks a contact unsubscribed by staff (e.g. they asked by reply). Kept for good. */
export async function unsubscribeContact(id: string): Promise<boolean> {
  return (
    (
      await query(
        `update marketing_contacts set unsubscribed_at = coalesce(unsubscribed_at, now()), updated_at = now() where id = $1 returning id`,
        [id],
      )
    ).length > 0
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
}

export async function listImports(): Promise<ImportRecord[]> {
  return query<ImportRecord>(
    `select id, file_name as "fileName", source, consent, added, updated, skipped, by_email as by, ${moment("at")} as at
       from marketing_imports order by at desc limit 50`,
  );
}
