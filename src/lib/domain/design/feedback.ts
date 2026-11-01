/**
 * Feedback (1 Nov 2026, Martin: Primero's copied across, wave 7): anyone in the business raises an improvement, a
 * request or an issue and comments on any; the owner ticks one off when it's done (ticked again to reopen); only the
 * person who raised it or the owner removes it. Kept for the business; nothing reaches a customer and nobody is
 * emailed. Pure, tested.
 */

export const FEEDBACK_KINDS = ["Improvement", "Request", "Issue"] as const;
export type FeedbackKind = (typeof FEEDBACK_KINDS)[number];
export const FEEDBACK_MAX = 2000;
export const FEEDBACK_TABS = [
  { id: "open", label: "To do" },
  { id: "done", label: "Done" },
  { id: "all", label: "All" },
] as const;
export type FeedbackTab = (typeof FEEDBACK_TABS)[number]["id"];

export interface FeedbackComment {
  id: string;
  by: string;
  at: string;
  text: string;
}

export interface FeedbackItem {
  id: string;
  kind: FeedbackKind;
  text: string;
  by: string;
  at: string;
  doneAt: string | null;
  doneBy: string | null;
  comments: FeedbackComment[];
}

const words = (raw: unknown) =>
  typeof raw === "string"
    ? raw
        .replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, "")
        .replace(/\n{3,}/g, "\n\n")
        .trim()
        .slice(0, FEEDBACK_MAX)
    : "";

/** A new item as sent: one of the kinds, and some words; or why not. */
export function cleanFeedback(raw: unknown): { ok: true; kind: FeedbackKind; text: string } | { ok: false; message: string } {
  const r = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const kind = FEEDBACK_KINDS.find((k) => k === r.kind);
  const text = words(r.text);
  if (!kind) return { ok: false, message: "Choose improvement, request or issue." };
  if (!text) return { ok: false, message: "Say what it is." };
  return { ok: true, kind, text };
}

export const cleanComment = words;

/** Open items first, then the newest. */
export function feedbackOrder(items: readonly FeedbackItem[], tab: FeedbackTab): FeedbackItem[] {
  return items
    .filter((i) => tab === "all" || (tab === "done" ? i.doneAt : !i.doneAt))
    .sort((a, b) => Number(Boolean(a.doneAt)) - Number(Boolean(b.doneAt)) || b.at.localeCompare(a.at));
}

/** Who may remove an item: the person who raised it, or the owner. */
export const mayRemove = (item: Pick<FeedbackItem, "by">, me: string, owner: boolean) => owner || item.by === me.toLowerCase();
