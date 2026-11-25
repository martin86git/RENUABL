import { todayInMarket } from "../market";
import { callerName, outcomeWords, type CallComing, type CallLogEntry } from "./call-log";

/**
 * Sol knows the business's own AI agents by name (26 Nov 2026, Martin: asked for "Andre's call logs", Sol answered with
 * Andrew Curwood, a customer, when Andre is the voice agent). His instructions name them, and agent_calls reads one's calls.
 */
export interface NamedAgent {
  name: string;
  /** What it does, in a few words: "sales voice agent", "post-sale voice agent". */
  job: string;
}

/** The lines for Sol's instructions; empty with no agent named. */
export function agentsBlock(agents: readonly NamedAgent[]): string {
  const named = agents.filter((a) => a.name.trim());
  if (!named.length) return "";
  const list = named.map((a) => `${a.name} (${a.job})`).join(", ");
  return `The business's own AI agents, never customers: ${list}. When they name one of these (even a name close to a customer's), they mean the agent: for its calls, use agent_calls, never find_deal.`;
}

/** The agent asked for, matched by name (any case, a name that starts the same); null when none is. */
export function agentNamed(agents: readonly NamedAgent[], asked: string): NamedAgent | null {
  const q = asked.trim().toLowerCase();
  if (!q) return null;
  return (
    agents.find((a) => a.name.trim().toLowerCase() === q) ??
    agents.find((a) => a.name.trim().toLowerCase().startsWith(q) || q.startsWith(a.name.trim().toLowerCase())) ??
    null
  );
}

/** A day as YYYY-MM-DD, "today" or "yesterday" (the market's), or null for no day. */
export function callDay(raw: unknown, now: Date = new Date()): string | null {
  const s = typeof raw === "string" ? raw.trim().toLowerCase() : "";
  if (s === "today") return todayInMarket(now);
  if (s === "yesterday") return todayInMarket(new Date(now.getTime() - 86_400_000));
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
}

const MOST = 25;

/** One agent's calls in words: those lined up, then those made (on a day, else the latest), each with its deal id. */
export function agentCallsWords(agent: string, calls: readonly CallLogEntry[], coming: readonly CallComing[], day: string | null): string {
  const mine = (by: string | undefined) => (by ?? "").trim().toLowerCase() === agent.trim().toLowerCase();
  const made = calls
    .filter((c) => c.who === "sol" && mine(callerName(c)))
    .filter((c) => !day || todayInMarket(new Date(c.at)) === day)
    .slice(0, MOST);
  const lined = coming.filter((c) => mine(c.by));
  const when = (iso: string) =>
    new Intl.DateTimeFormat("en-AU", {
      timeZone: "Australia/Melbourne",
      day: "numeric",
      month: "short",
      hour: "numeric",
      minute: "2-digit",
    }).format(new Date(iso));
  const lines = [
    `${agent}'s calls${day ? ` on ${day}` : " (latest first)"}:`,
    ...(lined.length
      ? [
          `Lined up or on now (${lined.length}):`,
          ...lined.map((c) => `- ${c.customer} · ${c.deal} (deal ${c.jobId}) · ${c.status === "calling" ? "on now" : "waiting"}`),
        ]
      : []),
    ...(made.length
      ? [
          `Made (${made.length}):`,
          ...made.map(
            (c) =>
              `- ${when(c.at)} · ${c.customer} · ${c.deal} (deal ${c.jobId}) · ${outcomeWords(c)}${c.words ? `: ${c.words.slice(0, 300)}` : ""}`,
          ),
        ]
      : [day ? `No calls made${day ? ` on ${day}` : ""}.` : "No calls made in the last 60 days."]),
  ];
  return lines.join("\n");
}
