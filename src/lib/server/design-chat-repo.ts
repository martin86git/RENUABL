/**
 * Server only. What the database keeps of the conversations between a
 * business and its customers (`design_messages`), one conversation a job.
 *
 * The same rule as the rest of the designer: every function takes the
 * business's id first and every statement carries `business_id = $1`. The
 * customer's side reaches these through `design-chat.ts`, which first turns
 * their proposal's private link into that one job: a link can read and add
 * to its own job's conversation and no other.
 */
import { MAX_CUSTOMER_LINES, type ChatLine, type ChatThread } from "@/lib/domain/design/chat";
import { newId, query, transaction } from "./db";

const moment = (column: string) => `to_char(${column} at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')`;

const LINE = `m.id, case when m.from_customer then 'customer' else 'business' end as "from", m.text, ${moment("m.at")} as at,
  m.by_email as by, (not m.from_customer or m.read_at is not null) as read`;

/** A job's conversation, oldest first (the newest at the foot, as it is read). The latest 500 lines. */
export async function chatLines(businessId: string, jobId: string): Promise<ChatLine[]> {
  const rows = await query<ChatLine>(
    `select * from (select ${LINE}, m.at as sent from design_messages m where m.business_id = $1 and m.job_id = $2 order by m.at desc, m.id desc limit 500) latest
      order by sent, id`,
    [businessId, jobId],
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

/**
 * Keeps a member's reply, and with it marks the customer's lines as read:
 * someone answering has seen them. Null when the business has no such job.
 */
export async function addReply(businessId: string, jobId: string, text: string, by: string): Promise<ChatLine | null> {
  return transaction(async (q) => {
    const jobs = await q<{ customer_id: string }>(`select customer_id from design_jobs where business_id = $1 and id = $2`, [
      businessId,
      jobId,
    ]);
    if (!jobs[0]) return null;
    await q(`update design_messages set read_at = now() where business_id = $1 and job_id = $2 and from_customer and read_at is null`, [
      businessId,
      jobId,
    ]);
    const rows = await q<ChatLine>(
      `insert into design_messages as m (id, business_id, job_id, customer_id, from_customer, text, by_email) values ($2,$1,$3,$4,false,$5,$6) returning ${LINE}`,
      [businessId, newId("msg"), jobId, jobs[0].customer_id, text, by.toLowerCase()],
    );
    return rows[0];
  });
}

/** Marks a job's messages from the customer as seen. Answers with how many were new. */
export async function markRead(businessId: string, jobId: string): Promise<number> {
  const rows = await query(
    `update design_messages set read_at = now() where business_id = $1 and job_id = $2 and from_customer and read_at is null returning id`,
    [businessId, jobId],
  );
  return rows.length;
}

/** How many of the business's customers' lines nobody has seen yet: the number beside Messages. */
export async function unreadCount(businessId: string): Promise<number> {
  const rows = await query<{ n: string }>(
    `select count(*) as n from design_messages where business_id = $1 and from_customer and read_at is null`,
    [businessId],
  );
  return Number(rows[0]?.n ?? 0);
}

/** The business's conversations that a customer has written in, the most recent first: each job once, with its customer's latest line. */
export async function chatThreads(businessId: string): Promise<ChatThread[]> {
  const rows = await query<ChatThread & { unread: string }>(
    `select j.id as "jobId", c.id as "customerId", c.name as "customerName", j.title, latest.text as last, ${moment("latest.at")} as at,
            (select count(*) from design_messages u where u.business_id = $1 and u.job_id = j.id and u.from_customer and u.read_at is null) as unread
       from design_jobs j
       join design_customers c on c.business_id = j.business_id and c.id = j.customer_id
       join lateral (select text, at from design_messages m where m.business_id = $1 and m.job_id = j.id and m.from_customer
                      order by m.at desc, m.id desc limit 1) latest on true
      where j.business_id = $1 order by latest.at desc limit 200`,
    [businessId],
  );
  return rows.map((row) => ({ ...row, unread: Number(row.unread) }));
}
