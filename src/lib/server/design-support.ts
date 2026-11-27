/**
 * Server only. RENUABL support tickets (domain/design/support.ts): a business raises one to RENUABL, RENUABL's staff
 * answer on /admin. The business's functions take the business id first, from the signed-in member only; the staff
 * functions at the foot read across businesses and are for /admin alone. Tables made by this file.
 */
import { randomBytes } from "node:crypto";
import { cleanKind, kindLabel } from "@/lib/domain/design/business-kind";
import { siteUrl } from "@/lib/domain/sms";
import {
  SUPPORT_LIMITS,
  staffTicketNote,
  stateAfter,
  supportReplyEmail,
  ticketRef,
  TICKET_AREAS,
  TICKET_STATES,
  type NewTicket,
  type Ticket,
  type TicketMessage,
  type TicketState,
} from "@/lib/domain/design/support";
import { query } from "./db";
import { tellStaff } from "./design-staff-note";
import { sendEmail } from "./email";

let ready: Promise<unknown> | null = null;
const tables = () =>
  (ready ??= (async () => {
    await query(`create table if not exists design_support_tickets (
  id text primary key,
  ref text not null unique,
  business_id text not null references businesses(id) on delete cascade,
  by_email text not null,
  subject text not null,
  area text not null,
  urgent boolean not null default false,
  state text not null default 'open',
  at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  replied_at timestamptz,
  seen_at timestamptz
)`);
    await query(`create table if not exists design_support_messages (
  id text primary key,
  ticket_id text not null references design_support_tickets(id) on delete cascade,
  business_id text not null references businesses(id) on delete cascade,
  side text not null,
  by_email text not null,
  text text not null,
  at timestamptz not null default now()
)`);
    await query(`create table if not exists design_support_pictures (
  id text primary key,
  message_id text not null references design_support_messages(id) on delete cascade,
  ticket_id text not null references design_support_tickets(id) on delete cascade,
  business_id text not null references businesses(id) on delete cascade,
  bytes bytea not null,
  content_type text not null,
  at timestamptz not null default now()
)`);
    await query(`create index if not exists design_support_pictures_message on design_support_pictures(message_id, at)`);
    await query(`create index if not exists design_support_tickets_business on design_support_tickets(business_id, updated_at desc)`);
    await query(`create index if not exists design_support_messages_ticket on design_support_messages(ticket_id, at)`);
  })().catch((e) => {
    ready = null;
    throw e;
  }));

const moment = (column: string) => `to_char(${column} at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')`;
const id = (prefix: string) => `${prefix}_${randomBytes(10).toString("hex")}`;

interface Row {
  id: string;
  ref: string;
  subject: string;
  area: string;
  urgent: boolean;
  state: string;
  by: string;
  at: string;
  updatedAt: string;
  unread: boolean;
  messages: { id: string; side: string; by: string; text: string; at: string; pictures: string[] | null }[];
}

/** `staff` keeps who at RENUABL wrote each line; a business is never sent it. */
const ticketOf = (r: Row, staff: boolean): Ticket => ({
  id: r.id,
  ref: r.ref,
  subject: r.subject,
  area: TICKET_AREAS.find((a) => a === r.area) ?? "Something else",
  urgent: r.urgent,
  state: TICKET_STATES.find((s) => s === r.state) ?? "open",
  by: r.by,
  at: r.at,
  updatedAt: r.updatedAt,
  unread: r.unread,
  messages: r.messages.map((m): TicketMessage => ({
    id: m.id,
    side: m.side === "renuabl" ? "renuabl" : "business",
    by: m.side === "renuabl" && !staff ? "" : m.by,
    text: m.text,
    at: m.at,
    pictures: m.pictures ?? [],
  })),
});

const SELECT = `select t.id, t.ref, t.subject, t.area, t.urgent, t.state, t.by_email as by, ${moment("t.at")} as at,
       ${moment("t.updated_at")} as "updatedAt",
       (t.replied_at is not null and (t.seen_at is null or t.seen_at < t.replied_at)) as unread,
       coalesce((select json_agg(json_build_object('id', m.id, 'side', m.side, 'by', m.by_email, 'text', m.text, 'at', ${moment("m.at")},
                 'pictures', (select json_agg(p.id order by p.at, p.id) from design_support_pictures p where p.message_id = m.id)) order by m.at)
                   from design_support_messages m where m.ticket_id = t.id), '[]') as messages`;

/** The business's tickets, newest touched first. Everyone in the business sees them. */
export async function listTickets(businessId: string): Promise<Ticket[]> {
  await tables();
  const rows = await query<Row>(`${SELECT} from design_support_tickets t where t.business_id = $1 order by t.updated_at desc limit 300`, [
    businessId,
  ]);
  return rows.map((r) => ticketOf(r, false));
}

/** Tickets RENUABL has answered that nobody in the business has opened since. */
export async function unreadTickets(businessId: string): Promise<number> {
  await tables();
  const rows = await query<{ n: number }>(
    `select count(*)::int as n from design_support_tickets
      where business_id = $1 and replied_at is not null and (seen_at is null or seen_at < replied_at)`,
    [businessId],
  );
  return rows[0]?.n ?? 0;
}

async function businessOf(businessId: string): Promise<{ name: string; kind: string }> {
  const rows = await query<{ name: string; kind: string }>(`select name, kind from businesses where id = $1`, [businessId]);
  return { name: rows[0]?.name ?? "A business", kind: kindLabel(cleanKind(rows[0]?.kind)) };
}

/** A picture already checked and redrawn (safeImage), ready to keep with a message. */
export interface TicketPicture {
  bytes: Buffer;
  contentType: string;
}

/** Keeps the business's words on a ticket with any pictures sent with them. */
async function keepMessage(businessId: string, ticketId: string, by: string, text: string, pictures: readonly TicketPicture[]) {
  const messageId = id("sm");
  await query(`insert into design_support_messages (id, ticket_id, business_id, side, by_email, text) values ($1,$2,$3,'business',$4,$5)`, [
    messageId,
    ticketId,
    businessId,
    by.toLowerCase(),
    text,
  ]);
  for (const p of pictures.slice(0, SUPPORT_LIMITS.pictures))
    await query(
      `insert into design_support_pictures (id, message_id, ticket_id, business_id, bytes, content_type) values ($1,$2,$3,$4,$5,$6)`,
      [id("sp"), messageId, ticketId, businessId, p.bytes, p.contentType],
    );
}

/** One of the business's own ticket pictures; null for anyone else's or none. */
export async function ticketPicture(businessId: string, pictureId: string): Promise<TicketPicture | null> {
  await tables();
  const rows = await query<{ bytes: Buffer; content_type: string }>(
    `select bytes, content_type from design_support_pictures where business_id = $1 and id = $2`,
    [businessId, pictureId],
  );
  return rows[0] ? { bytes: rows[0].bytes, contentType: rows[0].content_type } : null;
}

/** Raises a ticket and tells RENUABL's staff. "full" when the business already has too many open. */
export async function raiseTicket(
  businessId: string,
  by: string,
  ticket: NewTicket,
  pictures: readonly TicketPicture[] = [],
): Promise<{ ref: string; id: string } | "full"> {
  await tables();
  const open = await query<{ n: number }>(
    `select count(*)::int as n from design_support_tickets where business_id = $1 and state <> 'resolved'`,
    [businessId],
  );
  if ((open[0]?.n ?? 0) >= SUPPORT_LIMITS.open) return "full";
  const ticketId = id("st");
  let ref = "";
  for (let tries = 0; tries < 5 && !ref; tries++) {
    const candidate = ticketRef(randomBytes(6));
    const made = await query(
      `insert into design_support_tickets (id, ref, business_id, by_email, subject, area, urgent)
       values ($1,$2,$3,$4,$5,$6,$7) on conflict (ref) do nothing returning id`,
      [ticketId, candidate, businessId, by.toLowerCase(), ticket.subject, ticket.area, ticket.urgent],
    );
    if (made.length) ref = candidate;
  }
  if (!ref) throw new Error("no support reference could be made");
  await keepMessage(businessId, ticketId, by, ticket.text, pictures);
  const business = await businessOf(businessId);
  await tellStaff(
    staffTicketNote({
      ref,
      ...ticket,
      business: business.name,
      kind: business.kind,
      by: by.toLowerCase(),
      reply: false,
      site: siteUrl(),
      pictures: pictures.length,
    }),
  );
  return { ref, id: ticketId };
}

/** The business writes again on its own ticket (which reopens a resolved one). False when there's no such ticket. */
export async function replyToTicket(
  businessId: string,
  ticketId: string,
  by: string,
  text: string,
  pictures: readonly TicketPicture[] = [],
): Promise<boolean> {
  await tables();
  const rows = await query<{ ref: string; subject: string; area: string; urgent: boolean }>(
    `update design_support_tickets t set state = $3, updated_at = now(), seen_at = now()
      where t.business_id = $1 and t.id = $2
        and (select count(*) from design_support_messages m where m.ticket_id = t.id) < $4
      returning ref, subject, area, urgent`,
    [businessId, ticketId, stateAfter("business"), SUPPORT_LIMITS.messages],
  );
  const t = rows[0];
  if (!t) return false;
  await keepMessage(businessId, ticketId, by, text, pictures);
  const business = await businessOf(businessId);
  await tellStaff(
    staffTicketNote({
      ...t,
      text,
      business: business.name,
      kind: business.kind,
      by: by.toLowerCase(),
      reply: true,
      site: siteUrl(),
      pictures: pictures.length,
    }),
  );
  return true;
}

/** The business marks its own ticket resolved, or opens it again. */
export async function setTicketResolved(businessId: string, ticketId: string, resolved: boolean): Promise<boolean> {
  await tables();
  const rows = await query(
    `update design_support_tickets set state = $3, updated_at = now() where business_id = $1 and id = $2 returning id`,
    [businessId, ticketId, resolved ? "resolved" : "open"],
  );
  return rows.length > 0;
}

/** The business has opened the ticket: RENUABL's answer is read. */
export async function markTicketSeen(businessId: string, ticketId: string): Promise<void> {
  await tables();
  await query(`update design_support_tickets set seen_at = now() where business_id = $1 and id = $2`, [businessId, ticketId]);
}

// ── RENUABL's staff, on /admin. These read and write across businesses; never call them from a business's own routes. ──

export interface StaffTicket extends Ticket {
  business: string;
  kind: string;
}

export async function staffTickets(): Promise<StaffTicket[]> {
  await tables();
  const rows = await query<Row & { business: string; kind: string }>(
    `${SELECT}, b.name as business, b.kind
       from design_support_tickets t join businesses b on b.id = t.business_id
      where t.state <> 'resolved' or t.updated_at > now() - interval '30 days'
      order by t.updated_at desc limit 300`,
  );
  return rows.map((r) => ({ ...ticketOf(r, true), business: r.business, kind: kindLabel(cleanKind(r.kind)) }));
}

/** Any ticket's picture, for staff on /admin. */
export async function staffTicketPicture(pictureId: string): Promise<TicketPicture | null> {
  await tables();
  const rows = await query<{ bytes: Buffer; content_type: string }>(
    `select bytes, content_type from design_support_pictures where id = $1`,
    [pictureId],
  );
  return rows[0] ? { bytes: rows[0].bytes, contentType: rows[0].content_type } : null;
}

/**
 * Staff answer a ticket, and may resolve it with the answer. The person who raised it is emailed (when email and the
 * site's address are set up), from RENUABL support, with a link back to the ticket.
 */
export async function staffReply(ticketId: string, staffEmail: string, text: string, resolve: boolean): Promise<"done" | "emailed" | null> {
  await tables();
  const state: TicketState = resolve ? "resolved" : stateAfter("renuabl");
  const rows = await query<{ ref: string; subject: string; by_email: string; business_id: string }>(
    `update design_support_tickets set state = $2, updated_at = now(), replied_at = now() where id = $1
     returning ref, subject, by_email, business_id`,
    [ticketId, state],
  );
  const t = rows[0];
  if (!t) return null;
  await query(`insert into design_support_messages (id, ticket_id, business_id, side, by_email, text) values ($1,$2,$3,'renuabl',$4,$5)`, [
    id("sm"),
    ticketId,
    t.business_id,
    staffEmail.toLowerCase(),
    text,
  ]);
  const site = siteUrl();
  // A made-up business (a demo, a staff sample) has an address nothing is delivered to.
  if (!site || /\.example$/i.test(t.by_email)) return "done";
  const mail = supportReplyEmail({
    ref: t.ref,
    subject: t.subject,
    text,
    resolved: resolve,
    link: `${site}/design/support?ticket=${ticketId}`,
  });
  const escape = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  try {
    const sent = await sendEmail({
      to: t.by_email,
      subject: mail.subject,
      text: mail.text,
      html: `<p style="font-family:sans-serif;white-space:pre-wrap">${escape(mail.text)}</p>`,
      fromName: "RENUABL support",
    });
    return sent === "sent" ? "emailed" : "done";
  } catch (e) {
    console.error("support reply email failed", e instanceof Error ? e.message : e);
    return "done";
  }
}

/** Staff resolve a ticket without a word, or open it again. */
export async function staffSetResolved(ticketId: string, resolved: boolean): Promise<boolean> {
  await tables();
  const rows = await query(`update design_support_tickets set state = $2, updated_at = now() where id = $1 returning id`, [
    ticketId,
    resolved ? "resolved" : "open",
  ]);
  return rows.length > 0;
}
