/**
 * RENUABL support (26 Nov 2026, Martin: "we are going to need a renuabl support, where customer can raise a service
 * ticket for an issue"). A business on RENUABL raises a ticket to RENUABL itself: what it is about, what went wrong,
 * and whether it is stopping their work. RENUABL's staff answer from /admin; the conversation is the ticket's own, and
 * the business sees RENUABL's side only as "RENUABL support", never a staff member's email. Not Feedback (which stays
 * inside the business) and not the Service pipeline (a business's own customers' jobs). Pure, tested.
 */

export const TICKET_AREAS = [
  "Design tool",
  "Proposals",
  "Deals and CRM",
  "Calls and texts",
  "Email",
  "Sol",
  "Billing",
  "Something else",
] as const;
export type TicketArea = (typeof TICKET_AREAS)[number];

/** Where a ticket stands: with RENUABL, with the business (RENUABL answered), or resolved. */
export const TICKET_STATES = ["open", "waiting", "resolved"] as const;
export type TicketState = (typeof TICKET_STATES)[number];

export const SUPPORT_LIMITS = { subject: 120, text: 4000, messages: 200, open: 30 } as const;

export const TICKET_TABS = [
  { id: "open", label: "Open" },
  { id: "resolved", label: "Resolved" },
  { id: "all", label: "All" },
] as const;
export type TicketTab = (typeof TICKET_TABS)[number]["id"];

export type TicketSide = "business" | "renuabl";

export interface TicketMessage {
  id: string;
  side: TicketSide;
  /** The member who wrote it; empty for RENUABL's side (a business never sees who at RENUABL). */
  by: string;
  text: string;
  at: string;
}

export interface Ticket {
  id: string;
  /** The reference both sides quote, e.g. RS-4K7QX2. */
  ref: string;
  subject: string;
  area: TicketArea;
  /** It is stopping the business from working. */
  urgent: boolean;
  state: TicketState;
  by: string;
  at: string;
  updatedAt: string;
  /** RENUABL has answered since this business last opened it. */
  unread: boolean;
  messages: TicketMessage[];
}

const line = (raw: unknown, max: number) =>
  typeof raw === "string"
    ? raw
        .replace(/[\u0000-\u001f\u007f]/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, max)
    : "";

/** Words as typed: control characters out, runs of blank lines closed up. */
export const cleanTicketWords = (raw: unknown): string =>
  typeof raw === "string"
    ? raw
        .replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, "")
        .replace(/\n{3,}/g, "\n\n")
        .trim()
        .slice(0, SUPPORT_LIMITS.text)
    : "";

export interface NewTicket {
  subject: string;
  area: TicketArea;
  urgent: boolean;
  text: string;
}

/** A new ticket as sent, or why not. */
export function cleanTicket(raw: unknown): ({ ok: true } & NewTicket) | { ok: false; message: string } {
  const r = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const subject = line(r.subject, SUPPORT_LIMITS.subject);
  const text = cleanTicketWords(r.text);
  const area = TICKET_AREAS.find((a) => a === r.area) ?? "Something else";
  if (!subject) return { ok: false, message: "Give it a short title, so we can tell tickets apart." };
  if (!text) return { ok: false, message: "Tell us what happened." };
  return { ok: true, subject, area, urgent: r.urgent === true, text };
}

const REF_LETTERS = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";

/** A reference from random bytes: RS- and six characters, none easily misread (no 0, O, 1, I or L). */
export const ticketRef = (bytes: Uint8Array): string =>
  `RS-${Array.from(bytes.slice(0, 6), (b) => REF_LETTERS[b % REF_LETTERS.length]).join("")}`;

/** Where a ticket goes when a side writes: the business's words put it with RENUABL, RENUABL's with the business. */
export const stateAfter = (side: TicketSide): TicketState => (side === "business" ? "open" : "waiting");

export const STATE_WORDS: Record<TicketState, string> = {
  open: "With RENUABL",
  waiting: "RENUABL replied",
  resolved: "Resolved",
};
/** The same, as RENUABL's staff read it. */
export const STAFF_STATE_WORDS: Record<TicketState, string> = {
  open: "Needs a reply",
  waiting: "Waiting on them",
  resolved: "Resolved",
};

const inTab = (t: Pick<Ticket, "state">, tab: TicketTab) => tab === "all" || (tab === "resolved") === (t.state === "resolved");

/** A business's tickets: those RENUABL has answered first, then the latest touched. */
export function ticketOrder<T extends Pick<Ticket, "state" | "updatedAt" | "unread">>(tickets: readonly T[], tab: TicketTab): T[] {
  return tickets.filter((t) => inTab(t, tab)).sort((a, b) => Number(b.unread) - Number(a.unread) || b.updatedAt.localeCompare(a.updatedAt));
}

const STAFF_RANK: Record<TicketState, number> = { open: 0, waiting: 1, resolved: 2 };

/** Staff's order: what needs a reply first (urgent ahead, then the longest waiting), then waiting, then resolved (newest). */
export function staffOrder<T extends Pick<Ticket, "state" | "urgent" | "updatedAt">>(tickets: readonly T[]): T[] {
  return [...tickets].sort(
    (a, b) =>
      STAFF_RANK[a.state] - STAFF_RANK[b.state] ||
      (a.state === "open"
        ? Number(b.urgent) - Number(a.urgent) || a.updatedAt.localeCompare(b.updatedAt)
        : b.updatedAt.localeCompare(a.updatedAt)),
  );
}

/** What RENUABL's staff are emailed when a ticket is raised or the business writes again. */
export function staffTicketNote(t: {
  ref: string;
  subject: string;
  area: string;
  urgent: boolean;
  business: string;
  kind: string;
  by: string;
  text: string;
  reply: boolean;
  site: string | null;
}): { subject: string; text: string } {
  return {
    subject: `${t.urgent ? "URGENT · " : ""}Support ${t.ref}${t.reply ? " · reply" : ""}: ${t.subject}`,
    text: [
      t.reply ? `${t.by} at ${t.business} wrote again on ${t.ref}.` : `${t.by} at ${t.business} (${t.kind}) raised a support ticket.`,
      `About: ${t.area}${t.urgent ? " · it is stopping their work" : ""}`,
      "",
      t.text,
      "",
      t.site ? `Answer it on ${t.site}/admin#support` : "Answer it on /admin, under Support tickets.",
    ].join("\n"),
  };
}

/** What the person who raised a ticket is emailed when RENUABL answers. No staff member is named. */
export function supportReplyEmail(t: { ref: string; subject: string; text: string; resolved: boolean; link: string }): {
  subject: string;
  text: string;
} {
  return {
    subject: `RENUABL support ${t.ref}: ${t.subject}`,
    text: [
      t.resolved ? `We've answered your support ticket ${t.ref} and marked it resolved.` : `We've answered your support ticket ${t.ref}.`,
      "",
      t.text,
      "",
      `Read it and reply in RENUABL: ${t.link}`,
      "A reply to this email isn't read.",
      "",
      "RENUABL support",
    ].join("\n"),
  };
}
