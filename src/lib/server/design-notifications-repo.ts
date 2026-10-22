/**
 * Server only. A member's notifications (domain/design/mentions.ts): each @mention of them in a deal's note. Under the
 * designer's tenant rule (business id first, from the signed-in member only), and each member reads only their own.
 */
import { mentionEmail, mentionsIn } from "@/lib/domain/design/mentions";
import { siteUrl } from "@/lib/domain/sms";
import { newId, query } from "./db";
import { emailProvider, sendEmail } from "./email";

const moment = (column: string) => `to_char(${column} at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')`;

export interface Notification {
  id: string;
  kind: "mention";
  jobId: string;
  customerId: string;
  customer: string;
  title: string;
  text: string;
  by: string;
  at: string;
  read: boolean;
}

/**
 * A note's mentions: a notification for each member it mentions (never the writer), and an email to each when email
 * and the site's address are set up. Each email failing alone never loses the note or the others. The emails named.
 */
export async function notifyMentions(
  businessId: string,
  note: { jobId: string; customerId: string; text: string; by: string },
): Promise<string[]> {
  const members = await query<{ email: string }>(`select email from business_members where business_id = $1`, [businessId]);
  const to = mentionsIn(
    note.text,
    members.map((m) => m.email),
    note.by,
  );
  if (!to.length) return [];
  for (const email of to)
    await query(
      `insert into design_notifications (id, business_id, to_email, job_id, customer_id, text, by_email) values ($2,$1,$3,$4,$5,$6,$7)`,
      [businessId, newId("ntf"), email, note.jobId, note.customerId, note.text.slice(0, 2000), note.by.toLowerCase()],
    );
  const site = siteUrl();
  if (emailProvider() && site) {
    const rows = await query<{ name: string }>(`select name from design_customers where business_id = $1 and id = $2`, [
      businessId,
      note.customerId,
    ]);
    const email = mentionEmail({
      by: note.by,
      customer: rows[0]?.name ?? "a customer",
      text: note.text,
      link: `${site}/design/deals/${note.jobId}`,
    });
    for (const address of to)
      await sendEmail({ to: address, ...email, replyTo: note.by }).catch(() => console.error("a mention email couldn't be sent"));
  }
  return to;
}

/** A member's notifications, newest first (the latest 200), with the deal's customer and title. */
export async function listNotifications(businessId: string, email: string): Promise<Notification[]> {
  return query<Notification>(
    `select n.id, n.kind, n.job_id as "jobId", n.customer_id as "customerId", c.name as customer, j.title, n.text, n.by_email as by,
            ${moment("n.at")} as at, n.read_at is not null as read
       from design_notifications n
       join design_jobs j on j.business_id = n.business_id and j.id = n.job_id
       join design_customers c on c.business_id = j.business_id and c.id = j.customer_id
      where n.business_id = $1 and n.to_email = $2 order by n.at desc, n.id limit 200`,
    [businessId, email.toLowerCase()],
  );
}

export async function unreadNotifications(businessId: string, email: string): Promise<number> {
  const rows = await query<{ n: string }>(
    `select count(*) as n from design_notifications where business_id = $1 and to_email = $2 and read_at is null`,
    [businessId, email.toLowerCase()],
  );
  return Number(rows[0]?.n ?? 0);
}

/** Marks a member's own notifications read: those named, those on a deal, or all of them. */
export async function markNotificationsRead(
  businessId: string,
  email: string,
  which: { ids?: string[]; jobId?: string; all?: boolean },
): Promise<void> {
  const base = `update design_notifications set read_at = now() where business_id = $1 and to_email = $2 and read_at is null`;
  if (which.all) await query(base, [businessId, email.toLowerCase()]);
  else if (which.jobId) await query(`${base} and job_id = $3`, [businessId, email.toLowerCase(), which.jobId]);
  else if (which.ids?.length) await query(`${base} and id = any($3)`, [businessId, email.toLowerCase(), which.ids]);
}
