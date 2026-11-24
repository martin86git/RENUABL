import { agoWords, callBackAsked, stageOf, needsYou, nextMove, type FeedDeal, type FeedEvent, type NextMove } from "./deal-feed";
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

/**
 * What Sol puts to the person on a deal, in his own words (18 Nov 2026, Martin: the card read as someone reporting
 * what Sol had done; "it should be: I've proposed a draft email to Roberto, want me to send it?", then yes / no /
 * something else, like a live terminal). One proposal, first person, from the same move the deal feed picks
 * (`nextMove`), with what Yes does. `draft` says Sol's email is there to read, open under it.
 */
export interface SolProposal {
  say: string;
  /** What Yes does: send Sol's email, or one of the deal's moves. Null when there is nothing to agree to. */
  yes: { label: string; kind: NextMove["kind"] | "send" | "email" } | null;
  /** What No is: not sending the email, or putting the move aside for now. */
  no: string | null;
  draft: boolean;
}

export function solProposes(d: FeedDeal, now = new Date()): SolProposal {
  const name = first(d.customer);
  const move = nextMove(d, now);
  // Written in, but with no proposal out they have nowhere to read a chat reply (18 Nov 2026, Martin: Open the chat
  // did nothing there): an email answers them instead.
  if (move?.kind === "reply" && !d.proposal)
    return {
      say: `${name} has written in and is waiting on you, but has no proposal to read a reply on. Want to email ${name} back?`,
      yes: d.canEmail ? { label: `Email ${name}`, kind: "email" } : null,
      no: "Not now",
      draft: false,
    };
  if (move?.kind === "reply")
    return {
      say: `${name} has written in and is waiting on you. Want to answer them in the chat?`,
      yes: { label: "Open the chat", kind: "reply" },
      no: "Not now",
      draft: false,
    };
  if (d.sol) {
    const state = d.sol.state ?? (d.sol.held ? "held" : "counting");
    const what = d.sol.subject ? `: “${quoted(d.sol.subject)}”` : "";
    if (state === "no-email")
      return {
        say: `I've drafted an email to ${name}${what}, but there's no email address on their record. Add one and I'll send it.`,
        yes: { label: "Add their email", kind: "book" },
        no: null,
        draft: true,
      };
    if (state === "counting")
      return {
        say: `I'll email ${name}${what} ${countdownWords(d.sol.firesAt, now)}. Happy for it to go, or send it now?`,
        yes: { label: "Send it now", kind: "send" },
        no: "Hold it",
        draft: true,
      };
    return {
      say: `I've drafted an email to ${name}${what}. Want me to send it?`,
      yes: { label: "Yes, send it", kind: "send" },
      no: "No",
      draft: true,
    };
  }
  if (!move)
    return {
      say: `Nothing needs you on ${name}'s deal right now. I'll tell you here when that changes.`,
      yes: null,
      no: null,
      draft: false,
    };
  const ask: Record<string, string> = {
    design: d.projectId
      ? `${name}'s design is waiting on you. Shall we open it?`
      : `${name}'s roof isn't designed yet. Shall we design it now?`,
    proposal: `${name}'s system is designed and priced. Shall we send the proposal?`,
    call: callBackAsked(d) ? `${move.why} Who should make the call?` : `Nobody has spoken to ${name} yet. Who should make the call?`,
    approvals: `${name} has signed, but ${d.approvals ?? "the approvals aren't through yet"}. Shall we open the deal's details to move it on?`,
    book: `${name} has signed. Shall we book the installation day?`,
    deal: `${move.why} Want to take a look?`,
  };
  return { say: ask[move.kind] ?? move.why, yes: { label: move.label, kind: move.kind }, no: "Not now", draft: false };
}

/**
 * The deal's context in one line (18 Nov 2026, Martin: a recognisable "Context", in a colour of its own, "the most
 * concise short and efficient contextual explainer" so a proposal can be judged at a glance): where the deal stands
 * and for how long, how warm it is, what last happened and when, and whether the roof is designed.
 */
const CONTEXT_QUOTE_MAX = 60;

export function dealContext(d: FeedDeal, now = new Date()): string {
  const days = Math.floor((now.getTime() - Date.parse(d.createdAt)) / 86_400_000);
  const stage = stageOf(d);
  // How old the deal is, not how long at its stage (that isn't kept).
  const age = !Number.isFinite(days) || days < 1 ? `${stage} · new today` : `${stage} · ${days} ${days === 1 ? "day" : "days"} old`;
  const heat = d.heat ? d.heat[0].toUpperCase() + d.heat.slice(1) : null;
  const latest = d.events[0];
  const when = latest ? agoWords(latest.at, now) : "";
  const at = / ago$/.test(when) ? when : when === "Just now" || when === "Yesterday" ? when.toLowerCase() : `on ${when}`;
  const said = latest ? eventWords(latest, d.customer).replace(/\.$/, "") : "";
  // A customer's words kept short: the line is a glance, the record has the rest.
  const quote = said.endsWith("”");
  const short =
    said.length > CONTEXT_QUOTE_MAX ? `${said.slice(0, CONTEXT_QUOTE_MAX - 1 - (quote ? 1 : 0)).trimEnd()}…${quote ? "”" : ""}` : said;
  const last = latest ? `${short} ${at}` : "nothing on the record yet";
  // The design only matters while the deal is being sold.
  const selling = d.stage === "lead" || d.stage === "designed" || d.stage === "proposal";
  const design = d.kw ? `${d.kw.toFixed(1)} kW` : d.projectId ? "designed" : selling ? "no design yet" : null;
  return [age, heat, last, design].filter(Boolean).join(" · ");
}
