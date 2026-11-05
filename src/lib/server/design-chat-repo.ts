/**
 * Server only. What the database keeps of the conversations between a
 * business and its customers (`design_messages`), one conversation a job.
 *
 * The same rule as the rest of the designer: every function takes the
 * business's id first and every statement carries `business_id = $1`. The
 * customer's side reaches these through `design-chat.ts`, which first turns
 * their proposal's private link into that one job: a link can read and add
 * to its own job's conversation and no other.
 *
 * What has been read is each member's own (5 Nov 2026, Martin: one person
 * reading a conversation mustn't clear it for the rest): `design_chat_seen`
 * keeps when each member last saw each job's conversation, and a customer's
 * line is unread for a member while it came after that. Lines marked
 * `read_at` before then (read for the whole business, as it was) stay read
 * for everyone; nothing writes `read_at` any more.
 */
import type { DealViewer } from "@/lib/domain/design/account";
import { MAX_CUSTOMER_LINES, SOL_BY, type ChatLine, type ChatThread } from "@/lib/domain/design/chat";
import { newId, query, transaction } from "./db";
import { seen } from "./design-crm-repo";

const moment = (column: string) => `to_char(${column} at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')`;

/** A line as it was just kept: the business's own are read, a customer's is new. */
const LINE = `m.id, case when m.from_customer then 'customer' else 'business' end as "from", m.text, ${moment("m.at")} as at,
  m.by_email as by, (not m.from_customer or m.read_at is not null) as read`;

/** A customer's line still waiting for the member whose `design_chat_seen` row is s. */
const UNREAD_FOR = `m.from_customer and m.read_at is null and (s.seen_at is null or m.at > s.seen_at)`;
/** That member's row, the member's email being parameter `$2`. */
const SEEN_JOIN = `left join design_chat_seen s on s.business_id = m.business_id and s.job_id = m.job_id and s.member_email = $2`;

/**
 * A job's conversation, oldest first (the newest at the foot, as it is read). The latest 500 lines. `read` on the
 * customer's lines is as `reader` (a member's email) has seen them; without one, as the business had marked them.
 */
export async function chatLines(businessId: string, jobId: string, reader?: string): Promise<ChatLine[]> {
  const rows = await query<ChatLine>(
    `select * from (select m.id, case when m.from_customer then 'customer' else 'business' end as "from", m.text, ${moment("m.at")} as at,
        m.by_email as by, not (${UNREAD_FOR}) as read, m.at as sent
        from design_messages m ${SEEN_JOIN}
       where m.business_id = $1 and m.job_id = $3 order by m.at desc, m.id desc limit 500) latest
      order by sent, id`,
    [businessId, (reader ?? "").toLowerCase(), jobId],
  );
  return rows.map(({ id, from, text, at, by, read }) => ({ id, from, text, at, by, read }));
}

/**
 * Keeps a line the customer wrote. "full" past the limit for one job, so a
 * link that has leaked can't be used to fill the database. Null when the
 * business has no such job.
 */
export async function addCustomerLine(businessId: string, jobId: string, text: string): Promise<ChatLine | "full" | null> {
  return transaction(async (q) => {
    const jobs = await q<{ customer_id: string }>(`select customer_id from design_jobs where business_id = $1 and id = $2 for update`, [
      businessId,
      jobId,
    ]);
    if (!jobs[0]) return null;
    const count = await q<{ n: string }>(
      `select count(*) as n from design_messages where business_id = $1 and job_id = $2 and from_customer`,
      [businessId, jobId],
    );
    if (Number(count[0]?.n ?? 0) >= MAX_CUSTOMER_LINES) return "full";
    const rows = await q<ChatLine>(
      `insert into design_messages as m (id, business_id, job_id, customer_id, from_customer, text) values ($2,$1,$3,$4,true,$5) returning ${LINE}`,
      [businessId, newId("msg"), jobId, jobs[0].customer_id, text],
    );
    return rows[0];
  });
}

/** Marks a job's conversation seen by a member (`$3`, their email), now, never earlier than it was. Nothing for a job not there. */
const SEEN_NOW = `insert into design_chat_seen (business_id, job_id, member_email, seen_at)
  select $1, $2, $3, now() where exists (select 1 from design_jobs where business_id = $1 and id = $2)
  on conflict (business_id, job_id, member_email) do update set seen_at = greatest(design_chat_seen.seen_at, excluded.seen_at)`;

/**
 * Keeps a member's reply, and with it marks the customer's lines as read for
 * that member: someone answering has seen them (the rest of the team hasn't).
 * Null when the business has no such job.
 */
export async function addReply(businessId: string, jobId: string, text: string, by: string): Promise<ChatLine | null> {
  return transaction(async (q) => {
    const jobs = await q<{ customer_id: string }>(`select customer_id from design_jobs where business_id = $1 and id = $2`, [
      businessId,
      jobId,
    ]);
    if (!jobs[0]) return null;
    await q(SEEN_NOW, [businessId, jobId, by.toLowerCase()]);
    const rows = await q<ChatLine>(
      `insert into design_messages as m (id, business_id, job_id, customer_id, from_customer, text, by_email) values ($2,$1,$3,$4,false,$5,$6) returning ${LINE}`,
      [businessId, newId("msg"), jobId, jobs[0].customer_id, text, by.toLowerCase()],
    );
    return rows[0];
  });
}

/**
 * Keeps an answer Sol gave the customer, on the business's side and marked as his. Unlike a member's reply it marks
 * nothing read: the customer's lines still wait for someone at the business to see them. Null when the business has
 * no such job, or when anyone has written since the customer's line he answered (`after`): his answer is then late.
 */
export async function addSolLine(businessId: string, jobId: string, text: string, after: string): Promise<ChatLine | null> {
  return transaction(async (q) => {
    const jobs = await q<{ customer_id: string }>(`select customer_id from design_jobs where business_id = $1 and id = $2 for update`, [
      businessId,
      jobId,
    ]);
    if (!jobs[0]) return null;
    const since = await q<{ n: string }>(
      `select count(*) as n from design_messages where business_id = $1 and job_id = $2 and not from_customer and at > $3::timestamptz`,
      [businessId, jobId, after],
    );
    if (Number(since[0]?.n ?? 0) > 0) return null;
    const rows = await q<ChatLine>(
      `insert into design_messages as m (id, business_id, job_id, customer_id, from_customer, text, by_email) values ($2,$1,$3,$4,false,$5,$6) returning ${LINE}`,
      [businessId, newId("msg"), jobId, jobs[0].customer_id, text, SOL_BY],
    );
    return rows[0];
  });
}

/** Marks a job's messages from the customer as seen by this member (an email). Answers with how many were new to them. */
export async function markRead(businessId: string, jobId: string, member: string): Promise<number> {
  const email = member.toLowerCase();
  return transaction(async (q) => {
    const rows = await q<{ n: string }>(
      `select count(*) as n from design_messages m ${SEEN_JOIN} where m.business_id = $1 and m.job_id = $3 and ${UNREAD_FOR}`,
      [businessId, email, jobId],
    );
    await q(SEEN_NOW, [businessId, jobId, email]);
    return Number(rows[0]?.n ?? 0);
  });
}

/** How many of the customers' lines this member hasn't seen, on the deals they may see: the number beside Messages. */
export async function unreadCount(businessId: string, viewer: DealViewer): Promise<number> {
  const rows = await query<{ n: string }>(
    `select count(*) as n from design_messages m join design_jobs j on j.business_id = m.business_id and j.id = m.job_id ${SEEN_JOIN}
      where m.business_id = $1 and ${seen(viewer, 2)} and ${UNREAD_FOR}`,
    [businessId, viewer.email.toLowerCase()],
  );
  return Number(rows[0]?.n ?? 0);
}

/**
 * The business's conversations that a customer has written in, on the deals this member may see, the most recent
 * first: each job once, with its customer's latest line and how many of their lines this member hasn't seen.
 */
export async function chatThreads(businessId: string, viewer: DealViewer): Promise<ChatThread[]> {
  const rows = await query<ChatThread & { unread: string }>(
    `select j.id as "jobId", c.id as "customerId", c.name as "customerName", j.title, latest.text as last, ${moment("latest.at")} as at,
            (select count(*) from design_messages m ${SEEN_JOIN} where m.business_id = $1 and m.job_id = j.id and ${UNREAD_FOR}) as unread
       from design_jobs j
       join design_customers c on c.business_id = j.business_id and c.id = j.customer_id
       join lateral (select text, at from design_messages m where m.business_id = $1 and m.job_id = j.id and m.from_customer
                      order by m.at desc, m.id desc limit 1) latest on true
      where j.business_id = $1 and ${seen(viewer, 2)} order by latest.at desc limit 200`,
    [businessId, viewer.email.toLowerCase()],
  );
  return rows.map((row) => ({ ...row, unread: Number(row.unread) }));
}
