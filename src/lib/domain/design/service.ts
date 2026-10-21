/**
 * The service pipeline (22 Oct 2026, Martin: as Primero's): a business's jobs
 * flagged with something to put right after the sale, worked from Open
 * through In hand to Resolved. A case is raised on a deal (one open at a time
 * a deal; any number over its life), says what needs resolving, and keeps a
 * history of who did what and when. Every change is written on the deal's
 * record; nothing is sent to the customer. Pure, tested.
 */

export const SERVICE_STATES = ["open", "in-hand", "resolved"] as const;
export type ServiceState = (typeof SERVICE_STATES)[number];
export const SERVICE_STATE_LABEL: Record<ServiceState, string> = { open: "Open", "in-hand": "In hand", resolved: "Resolved" };

export interface ServiceUpdate {
  at: string;
  /** The member's email. */
  by: string;
  /** The state it moved to, when it moved. */
  state?: ServiceState;
  text?: string;
}

export interface ServiceCase {
  id: string;
  jobId: string;
  customerId: string;
  issue: string;
  state: ServiceState;
  raisedAt: string;
  raisedBy: string;
  resolvedAt: string | null;
  /** Oldest first. */
  updates: ServiceUpdate[];
}

export const MAX_ISSUE = 1000;
export const MAX_NOTE = 2000;
export const MAX_UPDATES = 100;

export const ISSUE_MISSING = "Say what the issue is.";
export const ALREADY_OPEN = "This deal already has a service case open.";

/** Words as kept: line breaks kept, other control characters taken out, trimmed and cut to length. */
export function cleanText(raw: unknown, max: number): string {
  return typeof raw === "string"
    ? raw
        .replace(/\r/g, "")
        .replace(/[\u0000-\u0009\u000b-\u001f\u007f]/g, " ")
        .trim()
        .slice(0, max)
    : "";
}

/** The case still to be put right on a deal, if any. */
export const openCaseFor = (cases: readonly ServiceCase[], jobId: string) =>
  cases.find((c) => c.jobId === jobId && c.state !== "resolved") ?? null;

/** Which moves a case can make from where it is. */
export function nextStates(state: ServiceState): ServiceState[] {
  return state === "open" ? ["in-hand", "resolved"] : state === "in-hand" ? ["resolved"] : ["open"];
}

/**
 * A change to a case: a move, a note, or both. Refused when it changes nothing, when the move isn't one it can make,
 * or when opening a resolved case again would give its deal a second open case.
 */
export function applyUpdate(
  c: ServiceCase,
  change: { state?: unknown; text?: unknown },
  by: string,
  at: string,
  others: readonly ServiceCase[],
): { ok: true; case: ServiceCase } | { ok: false; message: string } {
  const text = cleanText(change.text, MAX_NOTE);
  const state = SERVICE_STATES.includes(change.state as ServiceState) ? (change.state as ServiceState) : undefined;
  if (change.state !== undefined && !state) return { ok: false, message: "That isn't a step a case can take." };
  if (state && !nextStates(c.state).includes(state)) return { ok: false, message: "That isn't a step this case can take now." };
  if (
    state === "open" &&
    openCaseFor(
      others.filter((o) => o.id !== c.id),
      c.jobId,
    )
  )
    return { ok: false, message: ALREADY_OPEN };
  if (!state && !text) return { ok: false, message: "Write a note, or choose what happens next." };
  const update: ServiceUpdate = { at, by, ...(state ? { state } : {}), ...(text ? { text } : {}) };
  return {
    ok: true,
    case: {
      ...c,
      state: state ?? c.state,
      resolvedAt: state === "resolved" ? at : state === "open" ? null : c.resolvedAt,
      updates: [...c.updates, update].slice(-MAX_UPDATES),
    },
  };
}

/** How a change is written on the deal's record. */
export function recordLine(issue: string, update: ServiceUpdate): string {
  const head = update.state
    ? update.state === "open"
      ? "Service case opened again"
      : `Service case ${SERVICE_STATE_LABEL[update.state].toLowerCase()}`
    : "Service case note";
  return [head, `Issue: ${issue}`, ...(update.text ? [`Note: ${update.text}`] : [])].join("\n");
}

const DAY = 86_400_000;
/** Whole days a case has waited: since raised, until resolved. */
export function waitingDays(c: Pick<ServiceCase, "raisedAt" | "resolvedAt">, now: Date): number {
  const end = c.resolvedAt ? Date.parse(c.resolvedAt) : now.getTime();
  return Math.max(0, Math.floor((end - Date.parse(c.raisedAt)) / DAY));
}

export const PLANNER_FILTERS = [
  { id: "to-resolve", label: "To resolve" },
  { id: "resolved", label: "Resolved" },
  { id: "all", label: "All" },
] as const;
export type PlannerFilter = (typeof PLANNER_FILTERS)[number]["id"];

/**
 * The planner's order: open cases first, longest waiting first; then in hand, longest waiting first; then resolved,
 * the most recently resolved first.
 */
export function plannerOrder<T extends Pick<ServiceCase, "state" | "raisedAt" | "resolvedAt">>(
  cases: readonly T[],
  filter: PlannerFilter,
): T[] {
  const rank: Record<ServiceState, number> = { open: 0, "in-hand": 1, resolved: 2 };
  return cases
    .filter((c) => (filter === "all" ? true : filter === "resolved" ? c.state === "resolved" : c.state !== "resolved"))
    .sort((a, b) => {
      if (a.state !== b.state) return rank[a.state] - rank[b.state];
      if (a.state === "resolved") return (b.resolvedAt ?? "").localeCompare(a.resolvedAt ?? "");
      return a.raisedAt.localeCompare(b.raisedAt);
    });
}

/** Every word typed is found somewhere in the case or its customer, in any order. */
export function matchesSearch(haystack: readonly (string | null | undefined)[], query: string): boolean {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  const text = haystack.filter(Boolean).join(" ").toLowerCase();
  return words.every((w) => text.includes(w));
}

/** How many cases are still to put right: the nav's count. */
export const toResolve = (cases: readonly Pick<ServiceCase, "state">[]) => cases.filter((c) => c.state !== "resolved").length;
