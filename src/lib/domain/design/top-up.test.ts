import { describe, expect, it } from "vitest";
import { TOP_UP_DEFAULTS, cleanTopUp, cleanTopUpKind, topUpDue, topUpPackCents, topUpPackCredits, topUpWords } from "./top-up";

const now = new Date("2026-11-16T03:00:00Z");
const on = (kind: "design" | "sol") => ({ ...TOP_UP_DEFAULTS[kind], on: true });

describe("topping up by itself", () => {
  it("is off until the owner switches it on", () => {
    expect(TOP_UP_DEFAULTS.design.on).toBe(false);
    expect(TOP_UP_DEFAULTS.sol.on).toBe(false);
    expect(topUpDue({ kind: "design", settings: TOP_UP_DEFAULTS.design, left: 0, spentThisMonthCents: 0, last: null, now })).toBe("off");
  });

  it("buys only once the credits left fall below the floor", () => {
    const base = { kind: "design" as const, settings: on("design"), spentThisMonthCents: 0, last: null, now };
    expect(topUpDue({ ...base, left: 14 })).toBe("enough");
    expect(topUpDue({ ...base, left: 13 })).toBe("buy");
  });

  it("never goes past the monthly limit", () => {
    const base = { kind: "design" as const, settings: on("design"), left: 0, last: null, now };
    expect(topUpDue({ ...base, spentThisMonthCents: 24000 })).toBe("buy");
    expect(topUpDue({ ...base, spentThisMonthCents: 24001 })).toBe("cap");
  });

  it("waits between tries, and a day after a failed charge", () => {
    const base = { kind: "sol" as const, settings: on("sol"), left: 0, spentThisMonthCents: 0, now };
    expect(topUpDue({ ...base, last: { at: "2026-11-16T02:55:00Z", failed: false } })).toBe("too-soon");
    expect(topUpDue({ ...base, last: { at: "2026-11-16T02:45:00Z", failed: false } })).toBe("buy");
    expect(topUpDue({ ...base, last: { at: "2026-11-15T12:00:00Z", failed: true } })).toBe("too-soon");
    expect(topUpDue({ ...base, last: { at: "2026-11-15T02:00:00Z", failed: true } })).toBe("buy");
  });

  it("knows each pack's price and credits, bonus included", () => {
    expect(topUpPackCents("design", 150)).toBe(15000);
    expect(topUpPackCredits("design", 150)).toBe(165);
    expect(topUpPackCents("sol", 1000)).toBe(14900);
    expect(topUpPackCents("design", 20)).toBeNull();
  });

  it("cleans what the browser sends, never a limit below one pack", () => {
    expect(cleanTopUpKind("sol")).toBe("sol");
    expect(cleanTopUpKind("voice")).toBeNull();
    expect(cleanTopUp("design", { on: true, pack: 600, below: 21, monthlyCapCents: 6000 })).toEqual({
      on: true,
      pack: 600,
      below: 21,
      monthlyCapCents: 60000,
    });
    expect(cleanTopUp("sol", { on: "yes", pack: 7, below: 3, monthlyCapCents: 1 })).toEqual(TOP_UP_DEFAULTS.sol);
  });

  it("says plainly what it will do", () => {
    expect(topUpWords("design", on("design"))).toBe("On: 60 credits for $60 when you have fewer than 14 left, up to $300 a month.");
    expect(topUpWords("sol", TOP_UP_DEFAULTS.sol)).toContain("Off");
  });
});
