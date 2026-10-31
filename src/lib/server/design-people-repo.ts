/**
 * Server only. The group email (domain/design/customers.ts): one email to the people chosen on the Customers page, each
 * their own copy greeted by name with their own link to stop group emails, written on each one's record. Under the
 * designer's tenant rule (business id first, from the signed-in member only). Unsubscribing is by the link's token
 * alone, and only ever stops group emails: an email to one customer from their deal still goes.
 */
import { groupEmail, groupRecipients } from "@/lib/domain/design/customers";
import { siteUrl } from "@/lib/domain/sms";
import { query, randomToken } from "./db";
import { record } from "./design-crm-repo";
import { sendEmail } from "./email";

export interface GroupResult {
  sent: number;
  noEmail: number;
  unsubscribed: number;
  over: number;
  failed: number;
}

/** Sends the group email to those chosen who have an address and haven't unsubscribed (up to the limit). */
export async function sendGroupEmail(
  member: { businessId: string; email: string },
  input: { business: string; subject: string; body: string; ids: string[] },
): Promise<GroupResult | "no-site"> {
  const site = siteUrl();
  if (!site) return "no-site";
  const people = await query<{ id: string; email: string; firstName: string; token: string | null; unsubscribed: boolean }>(
    `select id, email, case when first_name = '' then split_part(name, ' ', 1) else first_name end as "firstName",
            unsub_token as token, unsubscribed_at is not null as unsubscribed
       from design_customers where business_id = $1 and id = any($2)`,
    [member.businessId, input.ids],
  );
  const { to, noEmail, unsubscribed, over } = groupRecipients(people);
  let sent = 0;
  let failed = 0;
  for (const p of to) {
    let token = p.token;
    if (!token) {
      token = randomToken(20);
      await query(`update design_customers set unsub_token = $3 where business_id = $1 and id = $2 and unsub_token is null`, [
        member.businessId,
        p.id,
        token,
      ]);
      const kept = await query<{ token: string }>(`select unsub_token as token from design_customers where business_id = $1 and id = $2`, [
        member.businessId,
        p.id,
      ]);
      token = kept[0]?.token ?? token;
    }
    const email = groupEmail({
      business: input.business,
      subject: input.subject,
      body: input.body,
      firstName: p.firstName,
      unsubscribe: `${site}/u/${token}`,
    });
    try {
      await sendEmail({ to: p.email, ...email, replyTo: member.email });
      sent++;
      await record(query, member.businessId, {
        customerId: p.id,
        jobId: null,
        kind: "email",
        text: `Group email to ${p.email}: ${email.subject}\n\n${email.text.split("\n--\n")[0]}`.slice(0, 2000),
        by: member.email.toLowerCase(),
      }).catch(() => undefined);
    } catch {
      failed++;
    }
  }
  return { sent, noEmail, unsubscribed, over, failed };
}

/** The business a link's person belongs to, by name, for the unsubscribe page; null for a link that isn't one. */
export async function unsubscribeTarget(token: string): Promise<{ business: string; done: boolean } | null> {
  const rows = await query<{ business: string; done: boolean }>(
    `select b.name as business, c.unsubscribed_at is not null as done
       from design_customers c join businesses b on b.id = c.business_id where c.unsub_token = $1`,
    [token],
  );
  return rows[0] ?? null;
}

/** Stops group emails for the person whose link it is. Doing it twice changes nothing. */
export async function unsubscribe(token: string): Promise<boolean> {
  const rows = await query(
    `update design_customers set unsubscribed_at = coalesce(unsubscribed_at, now()) where unsub_token = $1 returning id`,
    [token],
  );
  return rows.length > 0;
}
