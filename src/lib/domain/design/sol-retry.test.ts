import { describe, expect, it } from "vitest";
import {
  SHOWN_MAX,
  anotherAnswerNote,
  cleanShown,
  cleanSolInput,
  cleanTurns,
  dropExchange,
  withoutAttachedNote,
  withoutLastExchange,
  type SolTurn,
} from "./sol";

let n = 0;
const t = (role: SolTurn["role"], text: string, pinned?: true): SolTurn => ({
  role,
  text,
  at: new Date(Date.UTC(2026, 10, 5, 9, 0, n++)).toISOString(),
  ...(pinned ? { pinned } : {}),
});

describe("trying another answer", () => {
  it("takes off the last question and what came after it, keeping pinned turns", () => {
    const turns = [
      t("you", "First"),
      t("sol", "One"),
      t("sol", "Kept", true),
      t("you", "Second"),
      t("sol", "Two"),
      t("sol", "Reminder: x"),
    ];
    const out = withoutLastExchange(turns)!;
    expect(out.question.text).toBe("Second");
    expect(out.answer.text).toBe("Reminder: x");
    expect(out.turns.map((x) => x.text)).toEqual(["First", "One", "Kept"]);
  });

  it("keeps a pinned answer after the question in place", () => {
    const turns = [t("you", "Q"), t("sol", "Pinned answer", true), t("sol", "Plain")];
    expect(withoutLastExchange(turns)!.turns.map((x) => x.text)).toEqual(["Pinned answer"]);
  });

  it("has nothing to try again without an answer after the last question", () => {
    expect(withoutLastExchange([t("you", "Waiting")])).toBeNull();
    expect(withoutLastExchange([])).toBeNull();
    expect(withoutLastExchange([t("sol", "Reminder only")])).toBeNull();
  });

  it("drops an exchange by when the question was asked, and nothing when it has gone", () => {
    const turns = [t("you", "A"), t("sol", "a"), t("you", "B"), t("sol", "b")];
    expect(dropExchange(turns, turns[2].at).map((x) => x.text)).toEqual(["A", "a"]);
    expect(dropExchange(turns, "2000-01-01T00:00:00.000Z")).toHaveLength(4);
  });

  it("tells Sol the answer not taken, and asks the question's words alone", () => {
    expect(anotherAnswerNote("Call them Tuesday.")).toContain('"""\nCall them Tuesday.\n"""');
    expect(anotherAnswerNote("x".repeat(9000)).length).toBeLessThan(7000);
    expect(withoutAttachedNote("Read this bill\n(Attached: bill.pdf)")).toBe("Read this bill");
  });
});

describe("a short line shown for a long question", () => {
  it("is one line, capped", () => {
    expect(cleanShown("  Ask about\n12 Sample St  ·  design 2 ")).toBe("Ask about 12 Sample St · design 2");
    const long = cleanShown("word ".repeat(100));
    expect(long.length).toBeLessThanOrEqual(SHOWN_MAX);
    expect(long.endsWith("…")).toBe(true);
    expect(cleanShown(42)).toBe("");
  });

  it("is taken from the browser and kept on the member's turn only", () => {
    expect(cleanSolInput({ text: "A long instruction for Sol", shown: "Think deeper" })?.shown).toBe("Think deeper");
    expect(cleanSolInput({ text: "Plain" })).not.toHaveProperty("shown");
    const [you, sol] = cleanTurns([
      { role: "you", text: "The whole instruction", at: "2026-11-05T09:00:00.000Z", shown: "Ask about 12 Sample St" },
      {
        role: "sol",
        text: "Done",
        at: "2026-11-05T09:00:05.000Z",
        shown: "no",
        goTo: { path: "/design/procurement/orders", label: "Ordering station" },
      },
    ]);
    expect(you.text).toBe("The whole instruction");
    expect(you.shown).toBe("Ask about 12 Sample St");
    expect(sol).not.toHaveProperty("shown");
    expect(sol.goTo).toEqual({ path: "/design/procurement/orders", label: "Ordering station" });
  });

  it("drops a kept page that isn't one of RENUABL's", () => {
    const [sol] = cleanTurns([{ role: "sol", text: "Done", at: "2026-11-05T09:00:05.000Z", goTo: { path: "https://example.com" } }]);
    expect(sol).not.toHaveProperty("goTo");
  });
});
