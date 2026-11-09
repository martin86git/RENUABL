import { describe, expect, it } from "vitest";
import { DESIGN_TIPS, NO_TIP_PREFS, TIP_RULES, cleanTipPrefs, tipFor, type TipVisit } from "./design-tips";

const later = 60_000;
const visit = (over: Partial<TipVisit> = {}): TipVisit => ({
  counts: {},
  shown: 0,
  openedAt: 0,
  now: later,
  busy: false,
  showing: false,
  ...over,
});

describe("tipFor", () => {
  it("waits for its moment to come often enough", () => {
    expect(tipFor("one-panel-moved", visit({ counts: { "one-panel-moved": 2 } }), NO_TIP_PREFS)).toBeNull();
    expect(tipFor("one-panel-moved", visit({ counts: { "one-panel-moved": 3 } }), NO_TIP_PREFS)?.id).toBe("pick-all");
  });
  it("shows a tip once, ever", () => {
    expect(tipFor("bill-typed", visit({ counts: { "bill-typed": 1 } }), { off: false, seen: ["design-from-bill"] })).toBeNull();
  });
  it("stays quiet when off, early, busy, showing one, or past the visit's tips", () => {
    const counts = { "bill-typed": 1 };
    expect(tipFor("bill-typed", visit({ counts }), { off: true, seen: [] })).toBeNull();
    expect(tipFor("bill-typed", visit({ counts, now: TIP_RULES.quietSeconds * 1000 - 1 }), NO_TIP_PREFS)).toBeNull();
    expect(tipFor("bill-typed", visit({ counts, busy: true }), NO_TIP_PREFS)).toBeNull();
    expect(tipFor("bill-typed", visit({ counts, showing: true }), NO_TIP_PREFS)).toBeNull();
    expect(tipFor("bill-typed", visit({ counts, shown: TIP_RULES.perVisit }), NO_TIP_PREFS)).toBeNull();
    expect(tipFor("bill-typed", visit({ counts }), NO_TIP_PREFS)?.act).toBe("design-for-me");
  });
});

describe("the tips", () => {
  it("each has its own id and plain words, never a code name", () => {
    expect(new Set(DESIGN_TIPS.map((t) => t.id)).size).toBe(DESIGN_TIPS.length);
    for (const t of DESIGN_TIPS) {
      expect(t.words.length).toBeLessThan(160);
      expect(t.words).not.toMatch(/\.(ts|tsx)\b|[a-z][A-Z][a-z]+\(/);
    }
  });
  it("reads back what was kept, and nothing else", () => {
    expect(cleanTipPrefs({ off: true, seen: ["pick-all", "nonsense", 3, "pick-all"] })).toEqual({ off: true, seen: ["pick-all"] });
    expect(cleanTipPrefs(null)).toEqual(NO_TIP_PREFS);
  });
});
