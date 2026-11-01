/**
 * Server only. Each member's own Gmail inbox (domain/design/inbox.ts): the newest emails matched to the business's
 * deals by the sender's address, an email opened whole, and the notes on it with whom it is shared. Under the
 * designer's tenant rule (business id first, from the signed-in member); a mailbox is only ever read for its own
 * member, and a shared email is only the copy taken when it was shared.
 */
import { randomBytes } from "node:crypto";
import type { DealViewer } from "@/lib/domain/design/account";
import { SHARED_TEXT_MAX, isAutomated, mayReadTalk, parseFrom, partsOf, withPictures, type InboxEmail } from "@/lib/domain/design/inbox";
import { mentionsIn } from "@/lib/domain/design/mentions";
import { query, transaction } from "./db";
import { seen, seenParams } from "./design-crm-repo";
import { listMembers } from "./design-repo";
import { atOf, attachment, fromOf, fullMessage, inboxMessages, subjectOf } from "./gmail";

const moment = (column: string) => `to_char(${column} at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')`;
type Who = { businessId: string; email: string };

/** Each sender's newest deal the viewer may see, by the customer's email address. */
async function dealsBySender(
  businessId: string,
  viewer: DealViewer,
  emails: string[],
): Promise<Map<string, { id: string; customer: string }>> {
  if (!emails.length) return new Map();
  const rows = await query<{ email: string; id: string; customer: string }>(
    `select distinct on (lower(c.email)) lower(c.email) as email, j.id, c.name as customer
       from design_customers c join design_jobs j on j.business_id = c.business_id and j.customer_id = c.id
      where c.business_id = $1 and lower(c.email) = any($2) and ${seen(viewer, 3)}
      order by lower(c.email), j.updated_at desc`,
    [businessId, emails, ...seenParams(viewer)],
  );
  return new Map(rows.map((r) => [r.email, { id: r.id, customer: r.customer }]));
}

export interface SharedEmail {
  owner: string;
  id: string;
  subject: string;
  from: { name: string; email: string };
  at: string;
  notes: number;
}

/** The member's newest emails, each with its deal and how many notes are on it; and the emails others shared with them. */
export async function inboxFor(member: Who, viewer: DealViewer): Promise<{ emails: InboxEmail[]; shared: SharedEmail[] }> {
  const messages = await inboxMessages(member);
  const froms = messages.map((m) => parseFrom(fromOf(m)));
  const [deals, counts, shared] = await Promise.all([
    dealsBySender(member.businessId, viewer, [...new Set(froms.map((f) => f.email))]),
    query<{ id: string; n: string }>(
      `select message_id as id, count(*) as n from design_email_notes where business_id = $1 and owner_email = $2 group by message_id`,
      [member.businessId, member.email.toLowerCase()],
    ),
    sharedWith(member),
  ]);
  const n = new Map(counts.map((c) => [c.id, Number(c.n)]));
  return {
    emails: messages.map((m, i) => ({
      id: m.id,
      threadId: m.threadId,
      from: froms[i],
      subject: subjectOf(m),
      snippet: (m.snippet ?? "")
        .replace(/&#39;/g, "'")
        .replace(/&quot;/g, '"')
        .replace(/&amp;/g, "&")
        .slice(0, 200),
      at: atOf(m),
      unread: (m.labelIds ?? []).includes("UNREAD"),
      automated: isAutomated(froms[i].email),
      deal: deals.get(froms[i].email) ?? null,
      notes: n.get(m.id) ?? 0,
    })),
    shared,
  };
}

export async function sharedWith(member: Who): Promise<SharedEmail[]> {
  const rows = await query<{
    owner: string;
    id: string;
    snapshot: { subject: string; from: { name: string; email: string }; at: string };
    n: string;
  }>(
    `select t.owner_email as owner, t.message_id as id, t.snapshot,
            (select count(*) from design_email_notes n where n.business_id = t.business_id and n.owner_email = t.owner_email and n.message_id = t.message_id) as n
       from design_email_talks t where t.business_id = $1 and $2 = any(t.shared) order by t.created_at desc limit 50`,
    [member.businessId, member.email.toLowerCase()],
  );
  return rows.map((r) => ({
    owner: r.owner,
    id: r.id,
    subject: r.snapshot.subject,
    from: r.snapshot.from,
    at: r.snapshot.at,
    notes: Number(r.n),
  }));
}

const decode = (b64url: string) => Buffer.from(b64url, "base64url").toString("utf8");

export interface OpenedEmail {
  id: string;
  owner: string;
  subject: string;
  from: { name: string; email: string };
  to: string;
  at: string;
  /** The email as sent, its own pictures put in; shown in a sandboxed frame, nothing in it runs. */
  html: string | null;
  text: string | null;
  files: { n: number; name: string; type: string; size: number }[];
  deal: { id: string; customer: string } | null;
  notes: EmailNote[];
  shared: string[];
  /** A shared copy: only its words are kept, so the frame and files aren't there. */
  copy: boolean;
}

export interface EmailNote {
  id: string;
  by: string;
  text: string;
  at: string;
}

const PICTURES = 8;
const PICTURE_BYTES = 4 * 1024 * 1024;

/** One of the member's own emails, whole, with its notes. */
export async function openEmail(member: Who, viewer: DealViewer, id: string): Promise<OpenedEmail> {
  const m = await fullMessage(member, id);
  const payload = m.payload ?? {};
  const parts = partsOf(payload);
  const from = parseFrom(fromOf(m));
  // The email's own pictures, carried in it by content id, put in place (up to a few, so a page stays light).
  const pictures: { cid: string; dataUrl: string }[] = [];
  let bytes = 0;
  for (const p of parts.inline.slice(0, PICTURES)) {
    const data = p.data
      ? Buffer.from(p.data, "base64url")
      : p.attachmentId
        ? await attachment(member, id, p.attachmentId).catch(() => null)
        : null;
    if (!data || bytes + data.length > PICTURE_BYTES) continue;
    bytes += data.length;
    pictures.push({ cid: p.cid, dataUrl: `data:${p.type};base64,${data.toString("base64")}` });
  }
  const [deals, talk] = await Promise.all([
    dealsBySender(member.businessId, viewer, [from.email]),
    talkOf(member.businessId, member.email, id),
  ]);
  return {
    id,
    owner: member.email.toLowerCase(),
    subject: subjectOf(m),
    from,
    to: (m.payload?.headers ?? []).find((h) => h.name.toLowerCase() === "to")?.value ?? "",
    at: atOf(m),
    html: parts.html ? withPictures(decode(parts.html), pictures) : null,
    text: parts.text ? decode(parts.text) : null,
    files: parts.files.map(({ n, name, type, size }) => ({ n, name, type, size })),
    deal: deals.get(from.email) ?? null,
    notes: talk?.notes ?? [],
    shared: talk?.shared ?? [],
    copy: false,
  };
}

/** A file from one of the member's own emails. */
export async function emailFile(member: Who, id: string, n: number): Promise<{ name: string; type: string; bytes: Buffer } | null> {
  const m = await fullMessage(member, id);
  const file = partsOf(m.payload ?? {}).files.find((f) => f.n === n);
  if (!file) return null;
  return { name: file.name, type: file.type, bytes: await attachment(member, id, file.attachmentId) };
}

async function talkOf(businessId: string, owner: string, id: string) {
  const talks = await query<{
    shared: string[];
    snapshot: { subject: string; from: { name: string; email: string }; at: string; text: string; to: string };
  }>(`select shared, snapshot from design_email_talks where business_id = $1 and owner_email = $2 and message_id = $3`, [
    businessId,
    owner.toLowerCase(),
    id,
  ]);
  if (!talks[0]) return null;
  const notes = await query<EmailNote>(
    `select id, by_email as by, text, ${moment("at")} as at from design_email_notes
      where business_id = $1 and owner_email = $2 and message_id = $3 order by at`,
    [businessId, owner.toLowerCase(), id],
  );
  return { ...talks[0], notes };
}

/** An email shared with this member: the copy taken when they were tagged, and its notes; null when it isn't theirs to read. */
export async function sharedEmail(member: Who, owner: string, id: string): Promise<OpenedEmail | null> {
  const talk = await talkOf(member.businessId, owner, id);
  if (!talk || !mayReadTalk({ owner: owner.toLowerCase(), shared: talk.shared }, member.email)) return null;
  const s = talk.snapshot;
  return {
    id,
    owner: owner.toLowerCase(),
    subject: s.subject,
    from: s.from,
    to: s.to,
    at: s.at,
    html: null,
    text: s.text,
    files: [],
    deal: null,
    notes: talk.notes,
    shared: talk.shared,
    copy: true,
  };
}

/**
 * A note on an email. On the member's own email it starts the talk (keeping a copy of that one email for anyone
 * tagged); on a shared one, only someone it is shared with may write. Anyone @tagged in the business is added to
 * whom it is shared with. Answers who was newly told, or null when it may not be written.
 */
export async function addEmailNote(member: Who, owner: string, id: string, text: string): Promise<{ told: string[] } | null> {
  const me = member.email.toLowerCase();
  const own = owner.toLowerCase() === me;
  let snapshot: object | null = null;
  if (own) {
    const talk = await talkOf(member.businessId, me, id);
    if (!talk) {
      const m = await fullMessage(member, id);
      const parts = partsOf(m.payload ?? {});
      const words = parts.text
        ? decode(parts.text)
        : parts.html
          ? decode(parts.html)
              .replace(/<style[\s\S]*?<\/style>/gi, "")
              .replace(/<[^>]+>/g, " ")
              .replace(/\s+/g, " ")
          : (m.snippet ?? "");
      snapshot = {
        subject: subjectOf(m),
        from: parseFrom(fromOf(m)),
        at: atOf(m),
        to: (m.payload?.headers ?? []).find((h) => h.name.toLowerCase() === "to")?.value ?? "",
        text: words.slice(0, SHARED_TEXT_MAX),
      };
    }
  }
  const members = (await listMembers(member.businessId)).map((m) => m.email);
  const tagged = mentionsIn(text, members, me).filter((e) => e !== owner.toLowerCase());
  return transaction(async (q) => {
    if (snapshot)
      await q(
        `insert into design_email_talks (business_id, owner_email, message_id, snapshot) values ($1,$2,$3,$4) on conflict do nothing`,
        [member.businessId, me, id, JSON.stringify(snapshot)],
      );
    const talks = await q<{ shared: string[] }>(
      `select shared from design_email_talks where business_id = $1 and owner_email = $2 and message_id = $3 for update`,
      [member.businessId, owner.toLowerCase(), id],
    );
    const talk = talks[0];
    if (!talk || !mayReadTalk({ owner: owner.toLowerCase(), shared: talk.shared }, me)) return null;
    const told = tagged.filter((e) => !talk.shared.includes(e));
    if (told.length)
      await q(`update design_email_talks set shared = $4 where business_id = $1 and owner_email = $2 and message_id = $3`, [
        member.businessId,
        owner.toLowerCase(),
        id,
        [...talk.shared, ...told],
      ]);
    await q(`insert into design_email_notes (id, business_id, owner_email, message_id, by_email, text) values ($1,$2,$3,$4,$5,$6)`, [
      `en_${randomBytes(10).toString("hex")}`,
      member.businessId,
      owner.toLowerCase(),
      id,
      me,
      text,
    ]);
    return { told };
  });
}
