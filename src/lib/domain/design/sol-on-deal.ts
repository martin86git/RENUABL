import { agoWords, needsYou, nextMove, type FeedDeal, type FeedEvent, type NextMove } from "./deal-feed";
import { countdownWords, type OutboxState } from "./sol-agents";

/**
 * Sol's line at the top of a deal (16 Nov 2026, Martin: make Sol a more active player on the CRM page;
 * LIVE_SOFTWARE.md: every screen answers what has been done, what is about to happen and what is needed from me).
 * Three answers, read by rule from the same record the deal feed is built from (deal-feed.ts), so it is free and says
 * the same thing as the deal's card on Today: what last happened, what Sol does next (the email he has lined up, with
 * its countdown), and the one thing a person needs to do, if anything.
 */
export interface SolOnDeal {
  happened: { text: string; ago: string } | null;
  next: { text: string; state: OutboxState; when: string } | null;
  need: { text: string; move: NextMove | null } | null;
}

const first = (name: string) => name.trim().split(/\s+/)[0] || "They";
const QUOTE_MAX = 120;

function quoted(text: string): string {
  const t = text.replace(/\s+/g, " ").trim();
  return t.length > QUOTE_MAX ? `${t.slice(0, QUOTE_MAX - 1).trimEnd()}…` : t;
}

/** What one thing on the record reads as, in a sentence. */
export function eventWords(e: FeedEvent, customer: string): string {
  const name = first(customer);
  const by = e.by && e.by !== "Sol" ? e.by : "Sol";
  switch (e.kind) {
    case "message":
      return `${name} wrote: “${quoted(e.text)}”`;
    case "opened":
      return `${name} opened the proposal.`;
    case "sol":
      return `Sol wrote to ${name}.`;
    case "email":
      return `${by} emailed ${name}.`;
    case "reply":
      return `${by} replied to ${name} in the chat.`;
    case "call":
      return `${by} logged a call with ${name}.`;
    case "note":
      // A line the customer made happen (opening their page, saying the home is theirs) says what it is.
      return e.by === "Customer" ? `${quoted(e.text).replace(/\.$/, "")}.` : `${by} added a note.`;
    case "proposal":
    case "stage": {
      const t = quoted(e.text).replace(/\.$/, "");
      return `${t}.`;
    }
  }
}

/** Sol's three answers for a deal, as the card at the top of its page says them. */
export function solOnDeal(d: FeedDeal, now = new Date()): SolOnDeal {
  const latest = d.events[0];
  const happened = latest
    ? { text: eventWords(latest, d.customer), ago: agoWords(latest.at, now) }
    : { text: "The deal was made. Nothing has happened on it yet.", ago: agoWords(d.createdAt, now) };

  const name = first(d.customer);
  let next: SolOnDeal["next"] = null;
  if (d.sol) {
    const state = d.sol.state ?? (d.sol.held ? "held" : "counting");
    const what = d.sol.subject ? `: “${quoted(d.sol.subject)}”` : "";
    next = {
      text: `Email ${name}${what}`,
      state,
      when:
        state === "counting"
          ? `Sends ${countdownWords(d.sol.firesAt, now)}`
          : state === "held"
            ? "Held until you send it"
            : state === "no-email"
              ? `No email for ${name} on file`
              : "Waits for you to send it",
    };
  }

  // The email Sol has lined up is the "next" answer; it only needs a person when it won't go by itself.
  const move = nextMove(d, now);
  const shownMove = move && !(move.kind === "review" && next?.state === "counting") ? move : null;
  const needText = shownMove ? shownMove.why : needsYou(d, now);
  const need = needText ? { text: needText, move: shownMove } : null;
  return { happened, next, need };
}
