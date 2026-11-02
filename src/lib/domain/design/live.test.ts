import { describe, expect, it } from "vitest";
import { cleanChoice, cleanLiveSnapshot, isLiveToken, liveStatusWords } from "./live";

const square: [number, number][] = [
  [10, 10],
  [20, 10],
  [20, 30],
  [10, 30],
];

describe("live co-design", () => {
  it("keeps only what the customer may see, with numbers in range", () => {
    const s = cleanLiveSnapshot({
      active: 1,
      designs: [
        {
          at: 0,
          name: "Option 1",
          kw: 6.65,
          panels: 14,
          panelName: "Jinko <b>475</b>",
          batteryKwh: 0,
          youPay: 5200,
          cost: 3100,
          margin: 2000,
          outlines: [square],
        },
        {
          at: 1,
          name: "With a battery",
          kw: 6.65,
          panels: 14,
          batteryKwh: 16,
          youPay: 12100,
          saving: 1450,
          payback: 8.3,
          outlines: [square, [[1, 2]]],
        },
      ],
      secret: "x",
    });
    expect(s.active).toBe(1);
    expect(s.designs).toHaveLength(2);
    expect(JSON.stringify(s)).not.toMatch(/cost|margin|secret|<b>/);
    expect(s.designs[0].panelName).toBe("Jinko b475/b");
    expect(s.designs[1].outlines).toHaveLength(1);
  });
  it("falls back to the first design and drops designs with no place", () => {
    const s = cleanLiveSnapshot({ active: 9, designs: [{ name: "x" }, { at: 2, kw: 5 }] });
    expect(s.designs.map((d) => d.at)).toEqual([2]);
    expect(s.active).toBe(2);
    expect(s.designs[0].name).toBe("Option 3");
  });
  it("only takes a choice the customer was shown", () => {
    const s = cleanLiveSnapshot({ designs: [{ at: 0 }, { at: 1 }] });
    expect(cleanChoice(1, s)).toBe(1);
    expect(cleanChoice(5, s)).toBeNull();
    expect(cleanChoice("1", s)).toBeNull();
  });
  it("says whether the customer is watching, and what they chose", () => {
    const now = new Date("2026-11-02T10:00:20Z");
    expect(liveStatusWords({ seenAt: "2026-11-02T10:00:12Z", choice: null, choiceName: null }, now)).toBe("Watching now");
    expect(liveStatusWords({ seenAt: "2026-11-02T09:50:00Z", choice: 1, choiceName: "With a battery" }, now)).toBe(
      "Opened the link · chose With a battery",
    );
    expect(liveStatusWords({ seenAt: null, choice: null, choiceName: null }, now)).toBe("Not opened yet");
  });
  it("knows a live link's token", () => {
    expect(isLiveToken("a".repeat(48))).toBe(true);
    expect(isLiveToken("a".repeat(47))).toBe(false);
  });
});
