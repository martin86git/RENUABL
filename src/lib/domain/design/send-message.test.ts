import { describe, expect, it } from "vitest";
import { MAX_LINE, type PublicLine } from "./chat";
import { ASSISTANT_SENTENCE, SEND_TEMPLATES, fillTemplate, firstTemplate, greetingOf, newFromBusiness, timeBreaks } from "./send-message";

const FILL = { first: "Alex", business: "Example Solar", until: "31 October 2026" };

describe("the drafts sent with a proposal", () => {
  it("are filled in with the customer, the business and the date, leaving no blanks", () => {
    for (const t of SEND_TEMPLATES) {
      const text = fillTemplate(t.id, FILL);
      expect(text).not.toMatch(/[{}]/);
      expect(text).toContain("Alex");
      expect(text).toContain("31 October 2026");
      expect(text.length).toBeLessThanOrEqual(MAX_LINE);
    }
  });
  it("read naturally when something is missing", () => {
    const text = fillTemplate("hello", { first: " ", business: "", until: "" });
    expect(text).toMatch(/^Hi there,/);
    expect(text).toContain("The team");
    expect(text).not.toContain("us team");
    expect(text).toContain("the date on the proposal");
  });
  it("make no promise the proposal doesn't (Australian Consumer Law)", () => {
    for (const t of SEND_TEMPLATES) expect(t.text).not.toMatch(/guarantee|exact|precise|best|first in|\$\d|\d+%|AI\b/i);
  });
  it("offer the update when the customer has already had a proposal", () => {
    expect(firstTemplate(false)).toBe("hello");
    expect(firstTemplate(true)).toBe("updated");
    expect(firstTemplate(false, true)).toBe("indicative");
    expect(firstTemplate(true, true)).toBe("updated");
  });
  it("explain the indicative way of working, the chat, and Sol only when he answers", () => {
    const text = fillTemplate("indicative", FILL);
    expect(text).toMatch(/indicative proposal/);
    expect(text).toMatch(/visit your home/);
    expect(text).toMatch(/final proposal/);
    expect(text).toMatch(/chat box/);
    expect(text).not.toMatch(/\bSol\b/);
    const withSol = fillTemplate("indicative", { ...FILL, assistant: true });
    expect(withSol).toContain(ASSISTANT_SENTENCE.trim());
    // Sol is said plainly to be an AI, and never to stand in for the team.
    expect(ASSISTANT_SENTENCE).toMatch(/\bAI\b/);
    expect(ASSISTANT_SENTENCE).toMatch(/team reads everything/);
  });
});

const line = (id: string, from: PublicLine["from"]): PublicLine => ({ id, from, text: id, at: "2026-10-18T01:00:00.000Z" });

describe("the conversation on the customer's page", () => {
  it("greets with the business's latest message", () => {
    expect(greetingOf([])).toBeNull();
    expect(greetingOf([line("a", "customer")])).toBeNull();
    expect(greetingOf([line("a", "business"), line("b", "customer"), line("c", "business"), line("d", "customer")])?.id).toBe("c");
  });
  it("counts the business's messages since the customer last wrote", () => {
    expect(newFromBusiness([])).toBe(0);
    expect(newFromBusiness([line("a", "business"), line("b", "customer")])).toBe(0);
    expect(newFromBusiness([line("a", "customer"), line("b", "business"), line("c", "business")])).toBe(2);
  });
});

describe("the times in a conversation", () => {
  it("show over the first message and after each pause of over an hour", () => {
    const at = (iso: string) => ({ at: iso });
    expect([...timeBreaks([])]).toEqual([]);
    expect([
      ...timeBreaks([
        at("2026-10-18T01:00:00.000Z"),
        at("2026-10-18T01:30:00.000Z"),
        at("2026-10-18T02:30:00.000Z"),
        at("2026-10-18T03:31:00.000Z"),
      ]),
    ]).toEqual([0, 3]);
  });
});
