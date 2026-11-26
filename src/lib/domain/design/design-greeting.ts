/**
 * The designer's greeting (25 Nov 2026, Martin: opening a finished design he needed a few seconds to take in that it was
 * finished): one line on the dock as the roof opens, gone at the first press. It says whether the design is complete and,
 * when it is, where its proposal stands; when it isn't, what is missing. Read by rule, nothing stored.
 */
import type { ReadinessItem } from "./readiness";

export interface ProposalGlance {
  state: "live" | "lapsed" | "withdrawn" | "accepted";
  openedAt: string | null;
  indicative: boolean;
}

export interface DesignGreeting {
  tone: "done" | "todo";
  /** "Design complete" or "Design incomplete". */
  title: string;
  /** Where the proposal stands, or what is missing. */
  line: string;
}

/** The first thing to put right, in a few plain words. */
function missingWords(items: readonly ReadinessItem[], panels: number): string {
  const fix = items.filter((i) => i.state === "fix");
  const has = (id: ReadinessItem["id"]) => fix.some((i) => i.id === id);
  if (panels > 0 && has("inverter")) return "Panels are in, but no inverter yet.";
  const first = fix[0];
  if (!first) return "Something still needs doing.";
  const more = fix.length > 1 ? ` (+${fix.length - 1} more to fix)` : "";
  return `${first.words.replace(/\.$/, "")}${more}.`;
}

/**
 * The greeting for a roof as it opens. Null for an empty roof (Sol opens that one) or when the proposal isn't known yet
 * (`proposal` undefined while it loads; null means the roof has no proposal, or isn't on a deal).
 */
export function designGreeting(input: {
  panels: number;
  items: readonly ReadinessItem[];
  ready: boolean;
  proposal: ProposalGlance | null | undefined;
  onDeal: boolean;
}): DesignGreeting | null {
  if (input.panels === 0) return null;
  if (!input.ready) return { tone: "todo", title: "Design incomplete", line: missingWords(input.items, input.panels) };
  if (!input.onDeal) return { tone: "done", title: "Design complete", line: "Not on a deal yet, so no proposal." };
  if (input.proposal === undefined) return null;
  const p = input.proposal;
  const kind = p?.indicative ? "Indicative proposal" : "Proposal";
  if (!p || p.state === "withdrawn") return { tone: "done", title: "Design complete", line: "Proposal pending: not sent yet." };
  if (p.state === "accepted") return { tone: "done", title: "Design complete", line: `${kind} signed.` };
  if (p.state === "lapsed") return { tone: "done", title: "Design complete", line: `${kind} sent, but its price has lapsed.` };
  return {
    tone: "done",
    title: "Design complete",
    line: p.openedAt ? `${kind} sent and opened by the customer.` : `${kind} published, not opened yet.`,
  };
}
