/**
 * Server only. What happens when someone writes in a job's conversation.
 *
 * The customer writes from their proposal's private link (`customerSays`),
 * a member from the deal (`memberReplies`). Each is one function that keeps
 * the line first, and then does the rest (the customer's record, the email)
 * one thing at a time, each on its own: nothing that goes wrong afterwards
 * can lose the message or tell the person it wasn't sent.
 *
 * Email here follows the same rule as the acceptance notice: it is sent by
 * RENUABL, from RENUABL's own sender, only when an email service and the
 * site's address are set up, and it never holds the message up. To the
 * business it goes to its own listed addresses (or, with none listed, the
 * owner's sign-in address). To the customer it names the business plainly,
 * carries the one new message and a button back to their proposal, and asks
 * them to reply there: a reply by email isn't read, and it says so.
 */
import {
  CHAT_CLOSED,
  CHAT_FULL,
  businessReplied,
  customerWrote,
  filesNeedEmail,
  firstNameOf,
  publicMessages,
  teamName,
  type ChatLine,
  type PublicChat,
  type ReplyEmail,
} from "@/lib/domain/design/chat";
import { FROM_CUSTOMER, proposalPath } from "@/lib/domain/design/proposal";
import { solActive } from "@/lib/domain/design/sol-customer";
import { chatMessageEmail, chatReplyEmail } from "@/lib/domain/emails";
import { siteUrl } from "@/lib/domain/sms";
import { query, transaction } from "./db";
import { addCustomerLine, addReply, chatLines } from "./design-chat-repo";
import { jobById, record } from "./design-crm-repo";
import { canNotify } from "./design-notify";
import { solAnswersCustomer, solAnswersFor } from "./design-sol-customer";
import { loadBrand, proposalJob, tokenForJob } from "./design-proposal-repo";
import type { Member } from "./design-repo";
import { emailProvider, sendEmail } from "./email";
import { emailParts } from "./email-parts";
import { addDealFiles } from "./design-pulse-repo";

/** Runs one of the things that follow a message. A failure is logged in a word and goes no further. */
async function quietly(what: string, work: () => Promise<unknown>): Promise<void> {
  try {
    await work();
  } catch {
    console.error(`a chat message was kept, but ${what} failed`);
  }
}

/** The conversation as the customer behind a link may see it. Null for a link we never made. */
export async function publicChat(token: string): Promise<PublicChat | null> {
  const found = await proposalJob(token);
  if (!found) return null;
  const names = { customer: firstNameOf({ name: found.customerName }), business: teamName(found.businessName) };
  // A withdrawn proposal shows nothing of itself, its conversation included.
  if (found.withdrawn) return { open: false, messages: [], names };
  const lines = await chatLines(found.businessId, found.jobId);
  // Whether Sol is answering here now, so the page can show him writing: switched on, and not taken over by the team.
  const assistant = solActive(await solAnswersFor(found.businessId, found.businessName).catch(() => false), lines, new Date());
  return { open: true, messages: publicMessages(lines), names, assistant };
}

/**
 * A customer's message from their proposal's link: kept, then written on
 * their record, then the business is told by email (after the answer has
 * gone back, through `later`). Who it is from is decided here, by the link
 * it came through: nothing in what was typed can say otherwise.
 */
export async function customerSays(
  token: string,
  text: string,
  later: (work: () => Promise<void>) => void,
): Promise<{ chat: PublicChat } | { problem: string; status: number } | null> {
  const found = await proposalJob(token);
  if (!found) return null;
  if (found.withdrawn) return { problem: CHAT_CLOSED, status: 409 };
  const line = await addCustomerLine(found.businessId, found.jobId, text);
  if (!line) return null;
  if (line === "full") return { problem: CHAT_FULL, status: 429 };

  await quietly("writing it on the customer's record", () =>
    transaction((q) =>
      record(q, found.businessId, {
        customerId: found.customerId,
        jobId: found.jobId,
        kind: "message",
        text: customerWrote(text),
        by: FROM_CUSTOMER,
      }),
    ),
  );
  later(() => quietly("telling the business", () => tellBusiness(found, line)));
  // Sol answers while the customer is on the page, when the business has him on and the team hasn't taken over.
  later(() => quietly("Sol answering", () => solAnswersCustomer(token)));
  const chat = await publicChat(token);
  return chat ? { chat } : null;
}

/** Emails the business that a customer has written: to its listed addresses, or with none listed, to its owner. */
async function tellBusiness(found: NonNullable<Awaited<ReturnType<typeof proposalJob>>>, line: ChatLine): Promise<void> {
  const site = siteUrl();
  if (!emailProvider() || !site) return;
  const brand = await loadBrand(found.businessId, found.businessName);
  let to = brand.notify;
  if (!to.length) {
    const owners = await query<{ email: string }>(`select email from business_members where business_id = $1 and role = 'owner'`, [
      found.businessId,
    ]);
    to = owners.map((o) => o.email);
  }
  const email = chatMessageEmail({
    business: brand.name,
    customer: found.customerName,
    title: found.title,
    text: line.text,
    link: `${site}/design/deals/${found.jobId}?tab=chat`,
  });
  for (const address of to) await sendEmail({ to: address, ...email }).catch(() => console.error("a chat notice couldn't be sent"));
}

/**
 * A member's reply from the deal: kept (which marks the customer's lines as
 * read), written on the customer's record, and emailed to the customer when
 * that can be done. The answer says whether the email went, and why not.
 * Pictures and files (already checked, `formFiles`) go only with the email, so
 * a reply carrying them is refused before anything is kept when it can't be
 * emailed; once sent they are kept in the deal's Attachments and the line says
 * they went by email. Null when the business has no such job.
 */
export async function memberReplies(
  member: Member,
  jobId: string,
  text: string,
  files: readonly File[] = [],
): Promise<
  { lines: ChatLine[]; email: ReplyEmail; refused?: undefined } | { refused: string; lines?: undefined; email?: undefined } | null
> {
  const found = await jobById(member.businessId, jobId);
  if (!found) return null;
  const brand = await loadBrand(member.businessId, member.businessName);
  const token = await tokenForJob(member.businessId, jobId);
  const site = siteUrl();
  // Without a proposal out there is nowhere for the customer to read or answer it.
  const block: "switched-off" | "no-address" | "not-set-up" | null = !brand.emailReplies
    ? "switched-off"
    : !found.customer.email
      ? "no-address"
      : !canNotify() || !site || !token
        ? "not-set-up"
        : null;
  if (files.length && block) return { refused: filesNeedEmail(block) };
  const parts = await emailParts(files);
  // The chat on the proposal shows words only, so the line says what went with the email.
  const kept = parts.textLine ? `${text}\n\n${parts.textLine.replace(" attached.)", " attached to the email.)")}` : text;
  const line = await addReply(member.businessId, jobId, kept, member.email);
  if (!line) return null;

  await quietly("writing it on the customer's record", () =>
    transaction((q) =>
      record(q, member.businessId, {
        customerId: found.customer.id,
        jobId,
        kind: "message",
        text:
          businessReplied(text) +
          (parts.kept.length ? `\n(Emailed with ${parts.kept.map((f) => f.name).join(", ")}, kept in the deal's Attachments.)` : ""),
        by: member.email.toLowerCase(),
      }),
    ),
  );

  let email = (block ?? "failed") as ReplyEmail;
  if (!block)
    await quietly("emailing the customer", async () => {
      const message = chatReplyEmail({
        business: brand.name,
        customer: firstNameOf(found.customer),
        text,
        link: `${site}${proposalPath(token!)}#chat`,
        pictures: parts.picturesHtml,
        attached: parts.textLine,
      });
      await sendEmail({ to: found.customer.email, ...message, ...(parts.attachments.length ? { attachments: parts.attachments } : {}) });
      email = "emailed";
    });
  if (email === "emailed" && parts.kept.length)
    await quietly("keeping the files on the deal", () => addDealFiles(member.businessId, jobId, parts.kept, member.email));
  return { lines: await chatLines(member.businessId, jobId), email };
}
