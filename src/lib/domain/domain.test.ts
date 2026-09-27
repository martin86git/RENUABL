import { describe, expect, it } from "vitest";
import { advanceStatus, nextFieldStatus } from "./job-status";
import { marketDateTime, todayInMarket } from "./market";
import { rankInstallers } from "./matching";
import { estimateAnnualUsage, estimateOutcome, priceSystem, recommendSystem, ASSUMPTIONS } from "./recommendation";
import { buildAvailability, fromISODate } from "./scheduling";
import type { EnergyProfile } from "./types";
import { SAMPLE_ADDRESSES } from "@/lib/mock/addresses";
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
    expect(rankInstallers(INSTALLERS, "3350").map((r) => r.installer.id)).toEqual(["ins_goldfields"]); // Ballarat
    expect(rankInstallers(INSTALLERS, "3218").map((r) => r.installer.id)).toEqual(["ins_greenfield"]); // Geelong
    const brighton = rankInstallers(INSTALLERS, "3186");
    expect(brighton.length).toBeGreaterThan(1);
    expect(brighton[0].installer.id).toBe("ins_brightline");
    expect(brighton[0].score).toBeGreaterThanOrEqual(brighton[1].score);
  });

  it("covers every sample address", () => {
    for (const a of SAMPLE_ADDRESSES) expect(rankInstallers(INSTALLERS, a.postcode).length, a.suburb).toBeGreaterThan(0);
  });
});

describe("launch market time", () => {
  it("uses Melbourne's date, not the server's", () => {
    // 11pm UTC on 30 Sep is already 1 Oct in Melbourne.
    expect(todayInMarket(new Date("2026-09-30T23:00:00Z"))).toBe("2026-10-01");
  });

  it("converts Melbourne wall-clock time across daylight saving", () => {
    expect(marketDateTime("2026-09-28", 7, 30)).toBe("2026-09-27T21:30:00.000Z"); // AEST, UTC+10
    expect(marketDateTime("2026-10-12", 7, 30)).toBe("2026-10-11T20:30:00.000Z"); // AEDT, UTC+11
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
