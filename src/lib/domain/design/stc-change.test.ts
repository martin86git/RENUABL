import { describe, expect, it } from "vitest";
import { VERIFIED_RATES, type RebateRates } from "../rebates";
import { cleanSettings, DEFAULT_WORKSPACE } from "./pricing";
import { withoutCosts } from "./permissions";
import { buildProposal } from "./proposal";
import { sampleInputs } from "./proposal-fixture";
import { costSystem, stcValue } from "./quote";
import { systemSpecOf } from "./system";
import {
  LATER_DAYS,
  NOTICE_DAYS_AFTER,
  NOTICE_DAYS_BEFORE,
  addDays,
  changeWords,
  cleanStcFrom,
  laterUntil,
  lastStcChange,
  nextStcChange,
  pricedForWords,
  putAway,
  quoteStcLine,
  stcChanges,
  stcDrop,
  stcNotice,
  stcPeriod,
  stcPricingDate,
  typicalDrop,
} from "./stc-change";

const rates = VERIFIED_RATES;
const input = (today: string, more: Partial<Parameters<typeof stcNotice>[0]> = {}) => ({
  today,
  rates,
  stcFrom: null,
  stcPrice: 38,
  unsigned: [],
  ...more,
});

describe("the changes the rules give", () => {
  it("reads each 1 January and each battery factor step, soonest first", () => {
    const all = stcChanges(rates);
    expect(all.map((c) => c.on)).toEqual([...all.map((c) => c.on)].sort());
    expect(all.find((c) => c.on === "2027-01-01")).toEqual({
      on: "2027-01-01",
      solar: { from: 5, to: 4 },
      battery: { from: 6.8, to: 5.7 },
    });
    // 1 July: the battery alone.
    expect(all.find((c) => c.on === "2027-07-01")).toEqual({ on: "2027-07-01", solar: null, battery: { from: 5.7, to: 5.2 } });
    expect(all.find((c) => c.on === "2026-05-01")?.battery).toEqual({ from: 8.4, to: 6.8 });
  });

  it("says nothing past what the rules cover", () => {
    // 2031 isn't in the deeming table and no battery period follows 2030: no change is made up for 1 January 2031.
    expect(stcChanges(rates).some((c) => c.on >= "2031-01-01")).toBe(false);
    expect(nextStcChange("2030-08-01", rates)).toBeNull();
    const bare: RebateRates = { ...rates, stc: { ...rates.stc, deemingYears: { "2026": 5 }, batteryFactors: [] } };
    expect(stcChanges(bare)).toEqual([]);
    expect(stcNotice({ ...input("2026-12-20"), rates: bare })).toBeNull();
  });

  it("finds the next and the last change for a day", () => {
    expect(nextStcChange("2026-11-22", rates)?.on).toBe("2027-01-01");
    expect(nextStcChange("2027-01-01", rates)?.on).toBe("2027-07-01");
    expect(lastStcChange("2027-01-01", rates)?.on).toBe("2027-01-01");
    expect(stcPeriod("2026-11-22", rates)).toEqual({ from: "2026-05-01", to: "2026-12-31" });
  });
});

describe("the installation period new quotes are priced for", () => {
  it("is today unless a later first day is chosen, and never a day that has passed", () => {
    expect(stcPricingDate(null, "2026-11-22")).toBe("2026-11-22");
    expect(stcPricingDate(undefined, "2026-11-22")).toBe("2026-11-22");
    expect(stcPricingDate("2027-01-01", "2026-11-22")).toBe("2027-01-01");
    expect(stcPricingDate("2027-01-01", "2027-01-01")).toBe("2027-01-01");
    expect(stcPricingDate("2027-01-01", "2027-03-09")).toBe("2027-03-09");
  });

  it("is kept only as a real day", () => {
    expect(cleanStcFrom("2027-01-01")).toBe("2027-01-01");
    for (const bad of ["2027-02-30", "2027-1-1", "next year", 20270101, null, "1999-01-01", "2055-01-01"])
      expect(cleanStcFrom(bad)).toBeNull();
    expect(cleanSettings({ ...DEFAULT_WORKSPACE.settings, stcFrom: "2027-01-01" }).stcFrom).toBe("2027-01-01");
    expect(cleanSettings({ ...DEFAULT_WORKSPACE.settings, stcFrom: "<script>" }).stcFrom).toBeNull();
    // Settings saved before the setting existed behave as they always did.
    expect(cleanSettings({ stcPrice: 37 }).stcFrom).toBeNull();
    expect(DEFAULT_WORKSPACE.settings.stcFrom).toBeNull();
  });

  it("goes to someone who can't see costs too, so their designs price the same", () => {
    const settings = { ...DEFAULT_WORKSPACE, settings: { ...DEFAULT_WORKSPACE.settings, stcFrom: "2027-01-01" } };
    expect(withoutCosts(settings, []).settings.settings.stcFrom).toBe("2027-01-01");
  });

  it("says the period in words", () => {
    expect(pricedForWords(null, "2026-11-22", rates)).toBe("installs up to 31 December 2026");
    expect(pricedForWords("2027-01-01", "2026-11-22", rates)).toBe("installs from 1 January 2027 to 30 June 2027");
    expect(pricedForWords("2027-01-01", "2027-02-01", rates)).toBe("installs up to 30 June 2027");
  });
});

describe("how much less a system gets", () => {
  const change = nextStcChange("2026-11-22", rates)!;

  it("is the STC value the day before less the value on the day, at the business's own price", () => {
    const system = { pvKw: 6.65, batteryKwh: 16 };
    const before = stcValue(system, "3150", "2026-12-31", rates, 35);
    const after = stcValue(system, "3150", "2027-01-01", rates, 35);
    expect(stcDrop(system, "3150", change, rates, 35)).toBe(before - after);
    expect(before).toBeGreaterThan(after);
  });

  it("rounds the usual systems to $10, and leaves out a part that doesn't change", () => {
    const d = typicalDrop(change, rates, 38);
    expect(d.solar % 10).toBe(0);
    expect(d.solar).toBeGreaterThan(0);
    expect(d.battery).toBeGreaterThan(0);
    expect(
      typicalDrop(
        stcChanges(rates).find((c) => c.on === "2027-07-01")!,
        rates,
        38,
      ).solar,
    ).toBe(0);
  });

  it("says what changes", () => {
    expect(changeWords(change)).toBe("Solar's deeming years go from 5 to 4, and the battery factor from 6.8 to 5.7.");
    expect(changeWords({ on: "2027-07-01", solar: null, battery: { from: 5.7, to: 5.2 } })).toBe(
      "The battery factor goes from 5.7 to 5.2.",
    );
  });
});

describe("the notice", () => {
  it("starts eight weeks before the change, not sooner", () => {
    expect(stcNotice(input(addDays("2027-01-01", -(NOTICE_DAYS_BEFORE + 1))))).toBeNull();
    const n = stcNotice(input(addDays("2027-01-01", -NOTICE_DAYS_BEFORE)))!;
    expect(n.kind).toBe("coming");
    expect(n.days).toBe(NOTICE_DAYS_BEFORE);
  });

  it("before the change: says when, what, what quotes are priced for now, and offers the new period", () => {
    const n = stcNotice(input("2026-11-22", { unsigned: ["2026-11-10", "2026-11-20", "2027-01-01"] }))!;
    expect(n.title).toBe("STCs decrease on 1 January");
    expect(n.days).toBe(40);
    expect(n.key).toBe("coming:2027-01-01");
    expect(n.lines[0]).toBe("New quotes are priced for installs up to 31 December 2026.");
    expect(n.lines[1]).toMatch(/^Solar's deeming years go from 5 to 4.*about \$[\d,]+ less on a 6\.6 kW system.*An estimate\.$/);
    expect(n.outOld).toBe(2);
    expect(n.lines[2]).toMatch(/^2 proposals not yet signed are priced on the figures before 1 January\./);
    expect(n.apply).toEqual({ stcFrom: "2027-01-01", label: "Price new quotes for installs from 1 January" });
  });

  it("once new quotes are priced for the new period: quiet, unless proposals out are on the old figures", () => {
    expect(stcNotice(input("2026-11-22", { stcFrom: "2027-01-01" }))).toBeNull();
    const n = stcNotice(input("2026-11-22", { stcFrom: "2027-01-01", unsigned: ["2026-11-10"] }))!;
    expect(n.apply).toBeNull();
    expect(n.lines[0]).toBe("New quotes are already priced for installs from 1 January.");
    expect(n.needed).toBe("Publish it again if its install will land after 1 January.");
  });

  it("after the change: says it happened and what was priced on the old figures, for a month", () => {
    const n = stcNotice(input("2027-01-05", { unsigned: ["2026-12-15", "2027-01-03"] }))!;
    expect(n.kind).toBe("passed");
    expect(n.title).toBe("STCs decreased on 1 January");
    expect(n.days).toBe(4);
    expect(n.outOld).toBe(1);
    expect(n.apply).toBeNull();
    expect(n.needed).toBe("Publish it again to price it on the new figures.");
    expect(stcNotice(input("2027-01-05"))!.needed).toBeNull();
    expect(stcNotice(input(addDays("2027-01-01", NOTICE_DAYS_AFTER + 1)))).toBeNull();
  });

  it("never says a figure is exact or guaranteed", () => {
    for (const day of ["2026-11-22", "2027-01-05", "2027-06-01"]) {
      const n = stcNotice(input(day, { unsigned: ["2026-06-01"] }));
      const words = [n?.title, ...(n?.lines ?? []), n?.needed].join(" ");
      expect(words).not.toMatch(/exact|guarantee|precise|will save/i);
    }
  });

  it("Later puts it away for a week, never past the change, and only that notice", () => {
    const n = stcNotice(input("2026-11-22"))!;
    expect(laterUntil(n, "2026-11-22")).toBe(addDays("2026-11-22", LATER_DAYS));
    const close = stcNotice(input("2026-12-29"))!;
    expect(laterUntil(close, "2026-12-29")).toBe("2027-01-01");
    const kept = { key: n.key, until: "2026-11-29" };
    expect(putAway(n.key, kept, "2026-11-28")).toBe(true);
    expect(putAway(n.key, kept, "2026-11-29")).toBe(false);
    expect(putAway("passed:2027-01-01", kept, "2026-11-28")).toBe(false);
    expect(putAway(n.key, null, "2026-11-28")).toBe(false);
  });
});

describe("the quote builder's line", () => {
  const base = { rates, stcPrice: 38, system: { pvKw: 6.65, batteryKwh: 0 }, postcode: "3150" };

  it("says the period, and warns with this system's own drop while a change is near", () => {
    const line = quoteStcLine({ ...base, today: "2026-11-22", stcFrom: null });
    expect(line.pricedFor).toBe("STCs priced for installs up to 31 December 2026");
    const less = stcValue(base.system, "3150", "2026-12-31", rates, 38) - stcValue(base.system, "3150", "2027-01-01", rates, 38);
    expect(line.warn).toBe(`An install from 1 January gets about $${less.toLocaleString("en-AU")} less in STCs on this system.`);
    expect(line.near?.on).toBe("2027-01-01");
    expect(line.ahead).toBe(false);
  });

  it("stops warning once priced for the new period, and is quiet far from a change", () => {
    const ahead = quoteStcLine({ ...base, today: "2026-11-22", stcFrom: "2027-01-01" });
    expect(ahead.warn).toBeNull();
    expect(ahead.ahead).toBe(true);
    expect(ahead.pricedFor).toBe("STCs priced for installs from 1 January 2027 to 30 June 2027");
    const far = quoteStcLine({ ...base, today: "2026-08-01", stcFrom: null });
    expect(far.warn).toBeNull();
    expect(far.near).toBeNull();
  });
});

describe("a published proposal", () => {
  const publish = (today: string, stcFrom: string | null) => {
    const given = sampleInputs({ today });
    const result = buildProposal({
      ...given,
      workspace: { ...given.workspace, settings: { ...given.workspace.settings, stcFrom } },
    });
    if (!result.ok) throw new Error(result.problems.join(" "));
    return result;
  };

  it("is priced as it always was with no period chosen, and keeps the day it was priced for", () => {
    const now = publish("2026-11-22", null);
    expect(now.internal.stcDate).toBe("2026-11-22");
    expect(now.view.price.stc).toBe(sampleStc("2026-11-22"));
  });

  it("is priced for the business's installation period, the same figure the quote builder shows", () => {
    const ahead = publish("2026-11-22", "2027-01-01");
    expect(ahead.internal.stcDate).toBe("2027-01-01");
    expect(ahead.view.price.stc).toBe(sampleStc("2027-01-01"));
    expect(ahead.view.price.stc).toBeLessThan(publish("2026-11-22", null).view.price.stc);
    expect(ahead.view.price.youPay).toBe(ahead.view.price.incGst - ahead.view.price.stc);
    // A period that has passed is never priced for.
    expect(publish("2027-02-10", "2027-01-01").internal.stcDate).toBe("2027-02-10");
  });
});

function sampleStc(date: string) {
  const given = sampleInputs();
  const costing = costSystem(systemSpecOf(given.project.set.designs[0]), given.project.extras.quotes[0].form, given.workspace);
  return stcValue(costing, "3150", date, rates, given.workspace.settings.stcPrice);
}
