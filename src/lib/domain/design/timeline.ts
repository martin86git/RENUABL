/**
 * A deal's proposal timeline (1 Nov 2026, Martin: Primero's copied across, wave 6), in the design tool's Proposal view:
 * newest first, each publish a large point with what went out, option by option (system and price), then the smaller
 * points: opened, signed, taken back, the deposit, the chat with the customer and the emails sent from the deal.
 * Built from what is already kept (each version, the deal's record, its conversation); nothing new is stored. Pure, tested.
 */

export interface TimelineVersion {
  version: number;
  publishedAt: string;
  by: string;
  /** What went out: one line a system on offer. */
  options: { name: string; system: string; youPay: number }[];
}

export interface TimelineActivity {
  kind: string;
  text: string;
  by: string;
  at: string;
}

export interface TimelineMessage {
  fromCustomer: boolean;
  text: string;
  at: string;
}

export type TimelineKind = "published" | "proposal" | "customer" | "reply" | "email";

export interface TimelineEvent {
  kind: TimelineKind;
  at: string;
  title: string;
  detail?: string;
  by?: string;
  options?: TimelineVersion["options"];
}

/** A publish is drawn from its version (with its options), so the record's "Proposal sent" line isn't drawn twice. */
const isPublishLine = (text: string) => /^Proposal (\(version \d+\) )?sent$/.test(text);

const short = (text: string, n = 160) => {
  const one = text.replace(/\s+/g, " ").trim();
  return one.length > n ? `${one.slice(0, n - 1)}…` : one;
};

export function timelineOf(input: {
  versions: readonly TimelineVersion[];
  activity: readonly TimelineActivity[];
  messages: readonly TimelineMessage[];
}): TimelineEvent[] {
  const events: TimelineEvent[] = [
    ...input.versions.map((v) => ({
      kind: "published" as const,
      at: v.publishedAt,
      title: v.version === 1 ? "Proposal published" : `Version ${v.version} published`,
      by: v.by,
      options: v.options,
    })),
    ...input.activity
      .filter((a) => (a.kind === "proposal" && !isPublishLine(a.text)) || a.kind === "email")
      .map((a) => {
        if (a.kind === "email") {
          const [head, ...rest] = a.text.split("\n");
          return {
            kind: "email" as const,
            at: a.at,
            title: short(head ?? "Email", 90),
            detail: rest.join(" ").trim() ? short(rest.join(" ")) : undefined,
            by: a.by,
          };
        }
        return { kind: "proposal" as const, at: a.at, title: short(a.text, 120), by: a.by };
      }),
    ...input.messages.map((m) => ({
      kind: m.fromCustomer ? ("customer" as const) : ("reply" as const),
      at: m.at,
      title: m.fromCustomer ? "The customer wrote" : "You replied",
      detail: short(m.text),
    })),
  ];
  return events.sort((a, b) => b.at.localeCompare(a.at));
}
