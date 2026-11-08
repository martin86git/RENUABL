/**
 * Sol's rooms (8 Nov 2026, Martin: on the Service screen Sol brought up a datasheet he'd talked about in his side
 * panel; a screen with its own conversation shouldn't). A member's conversation with Sol is still one list, but a turn
 * asked from such a screen carries its room, and Sol is given only that room's history when asked from it. The side
 * panel, Today and his page go on reading every turn, as before.
 *
 * And the card Sol raises in the Service room to start a case (`start_service_case`): what he gathered from the
 * member's words, for the card to start from; the member picks the deal and the case is flagged only on their press.
 * Pure, tested.
 */
import type { SolTurn } from "./sol";

export const SOL_ROOMS = ["service"] as const;
export type SolRoom = (typeof SOL_ROOMS)[number];

/** A room as sent or kept: one of `SOL_ROOMS`, else none. */
export const cleanRoom = (v: unknown): SolRoom | undefined => ((SOL_ROOMS as readonly unknown[]).includes(v) ? (v as SolRoom) : undefined);

/** The turns Sol is given as the conversation so far: a room's own, or every turn when asked from no room. */
export const historyFor = (turns: readonly SolTurn[], room?: SolRoom): SolTurn[] =>
  room ? turns.filter((t) => t.room === room) : [...turns];

/** The card to start a service case, as Sol raises it: who or where he understood, and what needs putting right. */
export interface NewCaseAsk {
  /** A customer's name, a deal or an address, to start the search with; "" when they didn't say. */
  query: string;
  /** What needs putting right, in their words; "" when they didn't say. */
  issue: string;
}

const line = (v: unknown, max: number) =>
  typeof v === "string"
    ? v
        .replace(/[\u0000-\u0009\u000b-\u001f\u007f]/g, " ")
        .trim()
        .slice(0, max)
    : "";

/** The card as kept on a turn: both fields cut to length (the issue as long as a case's own). */
export function cleanNewCase(raw: unknown): NewCaseAsk | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const r = raw as Record<string, unknown>;
  return { query: line(r.query, 120).replace(/\n/g, " "), issue: line(r.issue, 1000) };
}

/** Sol's tool for it, offered only in the Service room. */
export const START_SERVICE_CASE_NOTE =
  "A card is now under your answer for them to find the deal (it searches as they type) and say what needs putting right; the case is flagged only when they press Flag for service. Say so in one short sentence. Don't ask them which customer in your words: the card asks.";
