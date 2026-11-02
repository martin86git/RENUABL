/**
 * The conversation between a business and its customer about a job: what
 * the customer writes from their proposal's private link, and what the
 * business's people write back from the deal. Pure: the shapes, the checks
 * on what is typed, and what each side is allowed to be shown.
 *
 * A conversation belongs to the job, not to a design or to one version of
 * the proposal, so it carries on when a design is deleted or the proposal is
 * published again. Who a line is from is decided by the server from how it
 * arrived (the private link, or a signed-in member): nothing typed can set it.
 *
 * The customer is never shown who at the business wrote a line: every line
 * of the business's reads as from "<Business> team". `publicMessages` is the
 * only way a line reaches the customer, and it carries the words, the side
 * and the time, and nothing else.
 */
import type { Cleaned } from "./crm";

/** A line as it is kept, and as the business's own people see it. */
export interface ChatLine {
  id: string;
  from: "customer" | "business";
  text: string;
  at: string;
  /** The member who wrote it (their sign-in email), or `SOL_BY` for Sol's answers. Null on the customer's lines. Never sent to the customer. */
  by: string | null;
  /** For the customer's lines: whether someone at the business has seen it. Always true on the business's own. */
  read: boolean;
}

/** A line as the customer is sent it. */
export interface PublicLine {
  id: string;
  from: "customer" | "business";
  text: string;
  at: string;
  /** On the business's side, an answer from Sol, the AI assistant, shown as his so nobody takes it for a person. */
  sol?: true;
}

/** Who wrote a line that Sol wrote, kept where a member's email would be. Never an email, so never a member. */
export const SOL_BY = "sol";

/** What the customer's side of the conversation is sent: the lines, and the two names they are shown under. */
export interface PublicChat {
  /** False once the proposal has been withdrawn: nothing is shown and nothing is taken. */
  open: boolean;
  /** Called messages, not lines: "lines" is a word for a quote's costed lines, which a test keeps out of everything a customer is sent. */
  messages: PublicLine[];
  names: { customer: string; business: string };
  /** Whether Sol answers in this conversation now: the page then shows him writing and looks for his answer sooner. */
  assistant?: boolean;
}

/** The longest line, and the most lines a customer can add to one job's conversation. */
export const MAX_LINE = 2000;
export const MAX_CUSTOMER_LINES = 200;
/** How often the customer's page asks for new lines while the chat is open, in seconds. */
export const POLL_SECONDS = 20;

export const LINE_MISSING = "Write a message first.";
export const CHAT_FULL = "This conversation is full. It's quicker to call or email us now.";
export const CHAT_CLOSED = "This proposal isn't available any more, so messages can't be sent from it.";

/** A message as typed: line breaks kept, control characters out, cut to a length. Nothing else in what was sent is looked at. */
export function cleanLine(raw: unknown): Cleaned<{ text: string }> {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const text =
    typeof r.text === "string"
      ? r.text
          .replace(/\r\n?/g, "\n")
          .replace(/[\u0000-\u0009\u000b-\u001f\u007f]/g, " ")
          .replace(/\n{3,}/g, "\n\n")
          .trim()
          .slice(0, MAX_LINE)
      : "";
  return text ? { ok: true, value: { text } } : { ok: false, message: LINE_MISSING };
}

/** The lines as the customer may see them: the side, the words and the time. Never who at the business wrote one, or what has been read. */
export function publicMessages(lines: readonly ChatLine[]): PublicLine[] {
  return lines.map(({ id, from, text, at, by }) => ({
    id,
    from,
    text,
    at,
    ...(from === "business" && by === SOL_BY ? { sol: true as const } : {}),
  }));
}

/** The name the business's lines are shown under: the business, never a person. */
export function teamName(business: string): string {
  return `${business.trim() || "The"} team`;
}

/** The name the customer's own lines are shown under: their first name, or the first word of their name. */
export function firstNameOf(customer: { firstName?: string; name: string }): string {
  return (customer.firstName || customer.name.trim().split(/\s+/)[0] || "You").slice(0, 40);
}

/** How many of the customer's latest lines have had no answer: what the designer's Chat button counts. */
export function unanswered(lines: readonly Pick<ChatLine, "from">[]): number {
  let n = 0;
  for (let i = lines.length - 1; i >= 0 && lines[i].from === "customer"; i--) n++;
  return n;
}

/** A conversation in the business's list of messages: the job it is about and where it stands. */
export interface ChatThread {
  jobId: string;
  customerId: string;
  customerName: string;
  /** What the job is called. */
  title: string;
  /** The customer's latest line, and when. */
  last: string;
  at: string;
  /** How many of the customer's lines nobody at the business has seen. */
  unread: number;
}

/** What a member is told after replying: whether the customer was emailed, and why not when they weren't. */
export type ReplyEmail = "emailed" | "no-address" | "not-set-up" | "switched-off" | "failed";

export function replyOutcome(email: ReplyEmail): string {
  if (email === "emailed") return "Sent, and emailed to the customer.";
  if (email === "no-address") return "Sent. Not emailed: there is no email address on file for this customer.";
  if (email === "not-set-up") return "Sent. Not emailed: email isn't set up on this server.";
  if (email === "switched-off") return "Sent. Not emailed: emailing replies is switched off in your settings.";
  return "Sent. The email to the customer couldn't be sent.";
}

/**
 * Why pictures and files can't go with a reply: they travel only in the email to the customer (the chat on their
 * proposal shows words), so a reply that won't be emailed can't carry them.
 */
export function filesNeedEmail(why: "no-address" | "not-set-up" | "switched-off"): string {
  const reason =
    why === "no-address"
      ? "there's no email address on file for this customer"
      : why === "switched-off"
        ? "emailing replies is switched off in your settings"
        : "email isn't set up here yet";
  return `Pictures and files go with the email to the customer, and ${reason}. Take them off to send the message.`;
}

/** What goes on the customer's record. */
export const customerWrote = (text: string) => `Message from the customer: ${text.slice(0, 300)}`;
export const businessReplied = (text: string) => `Reply sent: ${text.slice(0, 300)}`;
export const solReplied = (text: string) => `Sol answered: ${text.slice(0, 300)}`;
export const SOL_HANDED_OVER = "Sol passed the customer's question to the team: it needs an answer from someone at the business.";
