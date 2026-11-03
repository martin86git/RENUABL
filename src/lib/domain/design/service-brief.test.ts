import { describe, expect, it } from "vitest";
import type { ChatLine } from "./chat";
import { SOL_BY } from "./chat";
import type { ServiceCase } from "./service";
import {
  MAX_WORDS,
  briefByRule,
  briefFacts,
  briefKey,
  cleanBrief,
  customerWords,
  pendingByRule,
  teamTimeline,
  type CustomerWords,
  type TimelineStep,
} from "./service-brief";

const base: ServiceCase = {
  id: "svc_1",
  jobId: "job_a",
  customerId: "cus_a",
  issue: "Inverter showing an earth fault",
  state: "open",
  raisedAt: "2026-10-20T00:00:00.000Z",
  raisedBy: "sam@sunny.example",
  resolvedAt: null,
  updates: [],
};
const line = (from: ChatLine["from"], at: string, text: string, by: string | null = null): ChatLine => ({
  id: at,
  from,
  text,
  at,
  by,
  read: true,
});
const act = (kind: "call" | "email" | "note" | "service" | "stage", at: string, text: string, jobId: string | null = "job_a") => ({
  kind,
  at,
  text,
  by: "jo@sunny.example",
  jobId,
});

describe("what the customer wrote in", () => {
  it("takes their chat lines and logged calls from a fortnight before the case, oldest first, never ours", () => {
    const words = customerWords(
      base,
      [
        line("customer", "2026-09-01T00:00:00.000Z", "Long before: thanks for the quote"),
        line("customer", "2026-10-19T00:00:00.000Z", "The inverter screen says earth fault"),
        line("business", "2026-10-19T02:00:00.000Z", "We'll look into it", "jo@sunny.example"),
      ],
      [
        act("call", "2026-10-18T00:00:00.000Z", "Said the app went offline"),
        act("call", "2026-10-18T00:00:00.000Z", "Another deal", "job_b"),
      ],
    );
    expect(words.map((w) => w.text)).toEqual(["Said the app went offline", "The inverter screen says earth fault"]);
    expect(words[0]).toMatchObject({ via: "call", by: "jo" });
  });
  it("keeps only the latest few", () => {
    const chat = Array.from({ length: 8 }, (_, i) => line("customer", `2026-10-2${i}T00:00:00.000Z`, `Line ${i}`));
    expect(customerWords(base, chat, []).length).toBe(MAX_WORDS);
    expect(customerWords(base, chat, []).at(-1)?.text).toBe("Line 7");
  });
});

describe("what the team has done", () => {
  it("starts with the raise and lists case notes, our replies (Sol's named), emails, calls and notes since, not service lines", () => {
    const c: ServiceCase = {
      ...base,
      updates: [{ at: "2026-10-21T00:00:00.000Z", by: "jo@sunny.example", state: "in-hand", text: "Tech booked" }],
    };
    const steps = teamTimeline(
      c,
      [
        line("business", "2026-10-22T00:00:00.000Z", "Our tech is coming Thursday", "jo@sunny.example"),
        line("business", "2026-10-23T00:00:00.000Z", "Thanks for your patience", SOL_BY),
        line("business", "2026-10-01T00:00:00.000Z", "Before the case", "jo@sunny.example"),
      ],
      [act("email", "2026-10-24T00:00:00.000Z", "Visit confirmed"), act("service", "2026-10-21T00:00:00.000Z", "Service case in hand")],
    );
    expect(steps.map((s) => [s.kind, s.by, s.text])).toEqual([
      ["raised", "sam", "Flagged for service"],
      ["case", "jo", "Marked in hand: Tech booked"],
      ["reply", "jo", "Our tech is coming Thursday"],
      ["reply", "Sol", "Thanks for your patience"],
      ["email", "jo", "Visit confirmed"],
    ]);
  });
});

describe("what it waits on, by rule", () => {
  const raised: TimelineStep = { at: base.raisedAt, kind: "raised", by: "sam", text: "Flagged for service" };
  const theirs = (at: string): CustomerWords => ({ at, via: "chat", text: "Any news?" });
  it("is us when nobody has picked it up, or the customer wrote last", () => {
    expect(pendingByRule(base, [], [raised], "Chloe Fraser")).toBe("Waiting on us: nobody has picked it up yet.");
    const reply: TimelineStep = { at: "2026-10-21T00:00:00.000Z", kind: "reply", by: "jo", text: "On it" };
    expect(pendingByRule(base, [theirs("2026-10-22T00:00:00.000Z")], [raised, reply], "Chloe Fraser")).toMatch(
      /^Waiting on us: Chloe wrote last/,
    );
  });
  it("is the customer when our message or email was last", () => {
    const email: TimelineStep = { at: "2026-10-21T00:00:00.000Z", kind: "email", by: "jo", text: "Can you send a photo?" };
    expect(pendingByRule(base, [], [raised, email], "Chloe Fraser")).toBe("Waiting on Chloe to answer our email.");
  });
  it("is nothing once resolved", () => {
    expect(pendingByRule({ state: "resolved" }, [], [raised], "Chloe")).toBe("Nothing: it's resolved.");
  });
  it("gives the case's own words with no solution", () => {
    expect(briefByRule(base, [], [raised], "Chloe")).toMatchObject({ issue: base.issue, solution: "", from: "rule" });
  });
});

describe("Sol's brief", () => {
  const fallback = briefByRule(base, [], [], "Chloe");
  it("is kept only when it has an issue and a pending line", () => {
    expect(cleanBrief({ issue: "Earth fault.", solution: "- Send the electrician", pending: "Waiting on us." }, fallback)).toMatchObject({
      from: "sol",
      solution: "- Send the electrician",
    });
    expect(cleanBrief({ issue: "", solution: "x", pending: "y" }, fallback)).toBe(fallback);
    expect(cleanBrief("nonsense", fallback)).toBe(fallback);
  });
  it("is written again when anything new happens on the case", () => {
    const step: TimelineStep = { at: "2026-10-21T00:00:00.000Z", kind: "note", by: "jo", text: "x" };
    expect(briefKey(base, [], [])).not.toBe(briefKey(base, [], [step]));
    expect(briefKey(base, [], [])).not.toBe(briefKey({ state: "in-hand" }, [], []));
  });
  it("is given the case, what the customer said and what the team did", () => {
    const facts = briefFacts(
      base,
      {
        customer: "Chloe Fraser",
        title: "Solar",
        stage: "Installed",
        installDate: "2026-10-01",
        installer: "Sparks",
        system: "6.6 kW solar",
      },
      [{ at: "2026-10-19T00:00:00.000Z", via: "chat", text: "Earth fault on the screen" }],
      [{ at: base.raisedAt, kind: "raised", by: "sam", text: "Flagged for service" }],
    );
    expect(facts).toContain("CASE (Open, raised 2026-10-20): Inverter showing an earth fault");
    expect(facts).toContain("- 2026-10-19 in the chat: Earth fault on the screen");
    expect(facts).toContain("SYSTEM: 6.6 kW solar");
    expect(facts).toContain("- 2026-10-20 raised by sam: Flagged for service");
  });
});

describe("Sol's steps", () => {
  it("keep their line breaks", () => {
    const b = cleanBrief(
      { issue: "Fault.", solution: "- Call her\n\n- Send the electrician", pending: "Waiting on us." },
      briefByRule(base, [], [], "C"),
    );
    expect(b.solution).toBe("- Call her\n- Send the electrician");
  });
});
