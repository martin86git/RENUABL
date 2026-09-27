import { describe, expect, it } from "vitest";
import { advanceStatus, nextFieldStatus } from "./job-status";
import { rankInstallers } from "./matching";
import { estimateAnnualUsage, estimateOutcome, priceSystem, recommendSystem, ASSUMPTIONS } from "./recommendation";
import { buildAvailability, fromISODate } from "./scheduling";
import type { EnergyProfile } from "./types";
import { INSTALLERS } from "@/lib/mock/installers";

const base: EnergyProfile = {
  household: "3-4",
  bill: "400-700",
  daytime: "sometimes",
  ev: "none",
  storeys: "single",
  backup: "nice-to-have",
};

describe("recommendSystem", () => {
  it("sizes solar within panel limits", () => {
    const small = recommendSystem({ ...base, bill: "under-400" });
    const large = recommendSystem({ ...base, bill: "over-1000", ev: "have" });
    expect(small.recommended.panelCount).toBeGreaterThanOrEqual(ASSUMPTIONS.minPanels);
    expect(large.recommended.panelCount).toBeLessThanOrEqual(ASSUMPTIONS.maxPanels);
    expect(large.recommended.panelCount).toBeGreaterThan(small.recommended.panelCount);
  });

  it("adds a battery when backup matters", () => {
    expect(recommendSystem({ ...base, backup: "important" }).recommended.batteryKwh).toBeGreaterThan(0);
  });

  it("adds an EV charger for EV owners and planners", () => {
    expect(recommendSystem({ ...base, ev: "planning" }).recommended.evCharger).toBe(true);
    expect(recommendSystem(base).recommended.evCharger).toBe(false);
  });

  it("counts EV usage in annual usage", () => {
    expect(estimateAnnualUsage({ ...base, ev: "have" }) - estimateAnnualUsage(base)).toBe(ASSUMPTIONS.evAnnualKwh);
  });
});

describe("priceSystem", () => {
  it("applies rebates and keeps a fixed deposit", () => {
    const price = priceSystem({ panelCount: 20, batteryKwh: 10, evCharger: false }, { storeys: "double" });
    expect(price.total).toBe(price.gross - price.rebates);
    expect(price.deposit).toBe(199);
    expect(price.lines.some((l) => l.label.includes("Double-storey"))).toBe(true);
  });

  it("produces a positive payback estimate", () => {
    const config = { panelCount: 20, batteryKwh: 0, evCharger: false };
    const outcome = estimateOutcome(config, base, priceSystem(config, base));
    expect(outcome.annualSavings).toBeGreaterThan(0);
    expect(outcome.paybackYears).toBeGreaterThan(0);
  });
});

describe("rankInstallers", () => {
  it("only returns installers servicing the postcode, best first", () => {
    const ranked = rankInstallers(INSTALLERS, "3121");
    expect(ranked.map((r) => r.installer.id)).toEqual(["ins_greenfield"]);
    const sydney = rankInstallers(INSTALLERS, "2042");
    expect(sydney.length).toBeGreaterThan(1);
    expect(sydney[0].score).toBeGreaterThanOrEqual(sydney[1].score);
  });
});

describe("buildAvailability", () => {
  it("respects lead time and skips Sundays", () => {
    const from = new Date(2026, 8, 1);
    const days = buildAvailability("ins_brightline", from);
    expect(days.length).toBeGreaterThan(10);
    for (const d of days) {
      const date = fromISODate(d.date);
      expect(date.getDay()).not.toBe(0);
      expect(date.getTime()).toBeGreaterThan(from.getTime());
      expect(d.windows.length).toBeGreaterThan(0);
    }
  });
});

describe("field status flow", () => {
  it("advances sequentially and stops at complete", () => {
    let history = advanceStatus([]);
    expect(history.at(-1)?.status).toBe("en-route");
    for (let i = 0; i < 10; i++) history = advanceStatus(history);
    expect(history.map((h) => h.status)).toEqual(["en-route", "on-site", "installing", "final-checks", "complete"]);
    expect(nextFieldStatus("complete")).toBeNull();
  });
});
