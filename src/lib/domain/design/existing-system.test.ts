import { describe, expect, it } from "vitest";
import {
  cleanExisting,
  countedKw,
  existingDaily,
  existingForFinance,
  existingLine,
  existingMonthly,
  inverterRoom,
  inverterWords,
} from "./existing-system";
import { cleanExtras, defaultBill, designFinance, sharedHome, withHomeOf, type QuoteFields } from "./quote";

const bill = { interval: "quarterly" as const, amount: 600, supplyPerDay: 1, rate: 0.3, feedIn: 0.05 };
const none = new Array<number>(12).fill(0);

describe("the system a home already has", () => {
  it("is kept only when something of it is known, and cleaned", () => {
    expect(cleanExisting(null)).toBeNull();
    expect(cleanExisting({ kw: 0, inverter: "  " })).toBeNull();
    expect(cleanExisting({ kw: "8.72", inverterKw: 10, inverter: " Sungrow <b>SG10RS</b> ", batteryKwh: -3 })).toEqual({
      kw: 8.72,
      inverterKw: 10,
      inverter: "Sungrow b SG10RS /b",
    });
    expect(cleanExisting({ kw: 5000 })).toBeNull();
    expect(cleanExisting({ batteryKwh: 13.5 })).toEqual({ kw: 0, batteryKwh: 13.5 });
  });

  it("counts no more panels than its inverter takes", () => {
    expect(countedKw({ kw: 8.72, inverterKw: 10 })).toBe(8.72);
    expect(countedKw({ kw: 8, inverterKw: 5 })).toBe(6.65);
    expect(countedKw({ kw: 6.6 })).toBe(6.6);
  });

  it("makes what a north roof of that size makes on the site's yield", () => {
    const year = existingMonthly({ kw: 5 }, 3.6);
    expect(year).toHaveLength(12);
    expect(Math.abs(year.reduce((n, k) => n + k, 0) - 5 * 3.6 * 365)).toBeLessThan(15);
    // Summer makes more than winter.
    expect(year[0]).toBeGreaterThan(year[5] * 2);
    expect(existingDaily({ kw: 5 }, 3.6)).toBeCloseTo(18, 0);
  });

  it("gives finance nothing when nothing there makes or stores power", () => {
    expect(existingForFinance(null, 3.6)).toBeNull();
    expect(existingForFinance({ kw: 0, inverterKw: 5 }, 3.6)).toBeNull();
    expect(existingForFinance({ kw: 0, batteryKwh: 10 }, 3.6)?.batteryKwh).toBe(10);
  });

  it("says what the inverter can still take", () => {
    expect(inverterRoom({ kw: 8.72, inverterKw: 10 })).toEqual({ outKw: 10, roomKw: 4.58 });
    expect(inverterRoom({ kw: 6.6 })).toBeNull();
    expect(inverterWords({ kw: 8.72, inverterKw: 10 })).toMatch(/up to 10 kW.*about 4\.58 kW more panels/);
    expect(inverterWords({ kw: 6.6, inverterKw: 5 })).toMatch(/It is full/);
    expect(inverterWords({ kw: 8, inverterKw: 5 })).toMatch(/6\.65 kW is counted/);
    expect(inverterWords({ kw: 6.6 })).toBe("");
  });

  it("reads as a line", () => {
    expect(existingLine({ kw: 8.72, inverterKw: 10, inverter: "Sungrow", batteryKwh: 13.5 })).toBe(
      "8.72 kW of panels on a 10 kW Sungrow inverter, with a 13.5 kWh battery",
    );
    expect(existingLine({ kw: 0, batteryKwh: 10 })).toBe("a 10 kWh battery");
  });
});

describe("the bill with a system already on the home", () => {
  const there = existingForFinance({ kw: 6.6 }, 3.6)!;

  it("is unchanged with no existing system", () => {
    const year = existingMonthly({ kw: 6.6 }, 3.6);
    expect(designFinance(bill, year, 10, 0.4, null)).toEqual(designFinance(bill, year, 10, 0.4));
    expect(designFinance(bill, year, 10, 0.4)?.existingKwh).toBeUndefined();
  });

  it("works the home's real use back from what it bought", () => {
    const plain = designFinance(bill, none, 0, 0.4)!;
    const f = designFinance(bill, none, 0, 0.4, there)!;
    // The home uses more than the bill shows: the panels there supplied the rest.
    expect(f.dailyKwh).toBeGreaterThan(plain.dailyKwh);
    // Nothing added changes nothing: the bill stays as it is.
    expect(f.billNow).toBe(plain.billNow);
    expect(f.billAfter).toBe(f.billNow);
    expect(f.saving).toBe(0);
    expect(f.existingKwh).toBe(there.monthlyKwh.reduce((n, k) => n + k, 0));
    expect(f.productionKwh).toBe(f.existingKwh);
  });

  it("gives a battery on its own a saving from the panels already there", () => {
    const alone = designFinance(bill, none, 10, 0.4)!;
    expect(alone.saving).toBe(0);
    const f = designFinance(bill, none, 10, 0.4, there)!;
    expect(f.saving).toBeGreaterThan(300);
    // Less is sold once the battery takes the spare, so the saving is less than the power no longer bought.
    const kept = designFinance(bill, none, 0, 0.4, there)!;
    expect(f.exportedKwh).toBeLessThan(kept.exportedKwh);
    expect(f.saving).toBeLessThan((kept.exportedKwh - f.exportedKwh) * bill.rate);
  });

  it("adds new panels on top of the ones that stay", () => {
    const added = existingMonthly({ kw: 4 }, 3.6);
    const f = designFinance(bill, added, 0, 0.4, there)!;
    expect(f.productionKwh).toBe(added.reduce((n, k) => n + k, 0) + f.existingKwh!);
    expect(f.saving).toBeGreaterThan(0);
  });
});

describe("the existing system on a roof's quotes", () => {
  const defaults = { bill: defaultBill({ rate: 0.3, feedIn: 0.05, supplyPerDay: 1 }), postcode: "3150" };

  it("is kept with the home, and a design's keep or remove with the design", () => {
    const raw = {
      quotes: [
        { form: { existing: { kw: 8.72, inverterKw: 10, inverter: "Sungrow" } }, existingOut: true },
        { form: { existing: { kw: 99999 } }, existingOut: true },
      ],
    };
    const { quotes } = cleanExtras(raw, 2, defaults);
    expect(quotes[0].form.existing).toEqual({ kw: 8.72, inverterKw: 10, inverter: "Sungrow" });
    expect(quotes[0].existingOut).toBe(true);
    // Nothing known of it: nothing to take off.
    expect(quotes[1].form.existing).toBeUndefined();
    expect(quotes[1].existingOut).toBeUndefined();
  });

  it("is the same on every design, while each keeps its own choice", () => {
    const a: QuoteFields = { form: { phase: "single", roof: "tile", storeys: "single", postcode: "3150", existing: { kw: 5 } }, edits: {} };
    const b: QuoteFields = { form: { phase: "single", roof: "tile", storeys: "single", postcode: "3150" }, edits: {}, existingOut: true };
    const shared = sharedHome([a, b], 0);
    expect(shared[1].form.existing).toEqual({ kw: 5 });
    expect(shared[1].existingOut).toBe(true);
    expect(withHomeOf(b, a).existingOut).toBeUndefined();
  });
});

describe("the existing system where others read it", () => {
  it("is a line on the deal that says whether it stays, when that is known", async () => {
    const { existingDetail } = await import("./existing-system");
    const { designDetails, systemDetails } = await import("./deal");
    const e = { kw: 8.72, inverterKw: 10, inverter: "Sungrow" };
    expect(existingDetail(e)).toBe("8.72 kW of panels on a 10 kW Sungrow inverter");
    expect(existingDetail(e, false)).toMatch(/, staying$/);
    expect(existingDetail(e, true)).toMatch(/, being replaced$/);
    const form = { phase: "single" as const, roof: "tile" as const, storeys: "single" as const, postcode: "3150", existing: e };
    expect(designDetails(null, form, true).existingSystem).toMatch(/being replaced/);
    expect(designDetails(null, { ...form, existing: undefined }).existingSystem).toBeUndefined();
    const line = systemDetails(null, form).find((d) => d.key === "existingSystem");
    expect(line?.label).toBe("Already on the home");
  });

  it("tells the customer it is theirs already, with no word of ours about what it cost", async () => {
    const { existingForCustomer } = await import("./existing-system");
    const { COST_WORDS } = await import("./proposal");
    const stays = existingForCustomer({ kw: 8.72, batteryKwh: 10 }, false);
    expect(stays).toMatch(/^Your home already has 8\.72 kW of solar panels and a 10 kWh battery, which stay as they are\./);
    expect(stays).toMatch(/not part of this system/);
    const battery = existingForCustomer({ kw: 0, batteryKwh: 10 }, false);
    expect(battery).toMatch(/a 10 kWh battery, which stays as it is\. It is not part of this system/);
    const out = existingForCustomer({ kw: 6.6 }, true);
    expect(out).toBe("Your home already has 6.6 kW of solar panels. This system takes their place.");
    expect(existingForCustomer({ kw: 0, inverterKw: 5 }, false)).toBe("");
    for (const words of [stays, battery, out]) for (const w of COST_WORDS) expect(words.toLowerCase()).not.toContain(w.toLowerCase());
  });

  it("lets a battery on its own be ready to install, and counts both inverters on single phase", async () => {
    const { readiness, readinessLight } = await import("./readiness");
    const base = {
      panels: 0,
      inverters: 0,
      strings: [],
      unstrung: 0,
      ratio: null,
      tooClose: null,
      pitchSet: false,
      undecided: [],
      missing: 0,
      solarVic: { on: false, bar: null },
      phase: "single" as const,
      inverterKw: 0,
    };
    expect(readinessLight(readiness(base)).ready).toBe(false);
    const alone = readiness({ ...base, battery: true, existing: { kw: 8.72, inverterKw: 10 } });
    expect(readinessLight(alone).ready).toBe(true);
    expect(alone.find((i) => i.id === "panels")?.words).toMatch(/battery beside the 8\.72 kW already on the home/);
    expect(alone.find((i) => i.id === "export")?.words).toMatch(/10 kW of inverter on single phase \(10 kW of it already there\)/);
    // Without a battery there is still nothing to install.
    expect(readinessLight(readiness({ ...base, existing: { kw: 8.72, inverterKw: 10 } })).ready).toBe(false);
  });

  it("adds the panels already there to the home's day", async () => {
    const { homeDay } = await import("./home-day");
    const args = { latitude: -37.8, month: 0, panels: [], dayKwh: 0, homeDayKwh: 20, batteryKwh: 9 };
    const without = homeDay(args);
    const withIt = homeDay({ ...args, extraDayKwh: 30 });
    const made = (d: typeof without) => d.steps.reduce((n, s) => n + s.solar, 0) * 0.5;
    expect(made(without)).toBe(0);
    expect(made(withIt)).toBeCloseTo(30, 0);
    expect(withIt.steps.some((s) => s.level > 0)).toBe(true);
  });
});
