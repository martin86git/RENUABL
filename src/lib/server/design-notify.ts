/**
 * Server only. Tells a business that a customer has accepted a proposal: a
 * plain email from RENUABL's own sender to the extra addresses the business
 * has listed under Signed proposal emails.
 *
 * What this is and isn't. It goes to the business's own people, never to the
 * customer, and it is sent as RENUABL, not in the business's name: we don't
 * send email on a business's behalf. It says who accepted and which job, with
 * the way to the deal, and nothing else: not the price, not the bank details,
 * nothing of the proposal. Without an email service (as on a developer's own
 * computer) nothing is sent, and the settings page says so. It never holds
 * up, or fails, the customer's acceptance.
 */
import { proposalAcceptedEmail } from "@/lib/domain/emails";
import { siteUrl } from "@/lib/domain/sms";
import { acceptedNotice } from "./design-proposal-repo";
import { emailProvider, sendEmail } from "./email";

/** Whether an acceptance can be emailed at all here: an email service, and the site's own address for the link. */
export function canNotify(): boolean {
  return Boolean(emailProvider() && siteUrl());
}

export async function tellAccepted(token: string): Promise<void> {
  try {
    const site = siteUrl();
    if (!emailProvider() || !site) return;
    const notice = await acceptedNotice(token);
    if (!notice) return;
    const email = proposalAcceptedEmail({
      business: notice.business,
      customer: notice.customer,
      title: notice.title,
      acceptedBy: notice.acceptedBy,
      link: `${site}/design/deals/${notice.jobId}`,
    });
    for (const to of notice.to) {
      // One address failing doesn't stop the others. Only that it failed is logged: never the address or what was sent.
      await sendEmail({ to, ...email }).catch(() => console.error("an acceptance notice couldn't be sent"));
    }
  } catch {
    console.error("acceptance notices couldn't be worked out");
  }
}
