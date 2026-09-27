import { describe, expect, it } from "vitest";
import { advanceStatus, nextFieldStatus } from "./job-status";
import { buildCallAvailability, formatCallTime, hubspotEmbedSrc, isHubspotBookedMessage, parseHubspotMeetingsUrl } from "./booking";
import { CARE_FREE_MONTHS, careIncludedFor, careIncludedValue, carePrice, carePriceLabel, careYearlySaving } from "./care";
import { greeting, marketDateTime, todayInMarket } from "./market";
import { rankInstallers } from "./matching";
import {
  ADD_ONS,
  ASSUMPTIONS,
  describeSystem,
  batteryNeeded,
  estimateOutcome,
  priceSystem,
  recommendSystem,
  suggestedAdditions,
  TIER_LABELS,
  usageBasis,
} from "./recommendation";
import { summariseBill, type BillSummary } from "./bill";
import { INSTALL_ARRIVAL, buildAvailability, fromISODate } from "./scheduling";
import { SERVICE_WINDOWS, buildServiceAvailability, mayBeWarranty } from "./service";
import type { EnergyProfile, HomeAnalysis } from "./types";
import { SAMPLE_ADDRESSES } from "@/lib/mock/addresses";
import { INSTALLERS } from "@/lib/mock/installers";

const base: EnergyProfile = { ev: false, evPlanned: false, batteryPlanned: false, backup: false };
const analysis: HomeAnalysis = { storeys: "single", roof: "Colorbond", orientation: "North", maxPanels: 36 };
const bill = summariseBill({ isElectricityBill: true, periodDays: 91, usageKwh: 1547, eveningShare: 0.58, usageRate: 0.31 }) as BillSummary;

describe("summariseBill", () => {
  it("scales a billing period to a year and converts cents to dollars", () => {
    const b = summariseBill({ isElectricityBill: true, periodDays: 90, usageKwh: 1350, usageRate: 32, feedInRate: 3.3 }) as BillSummary;
    expect(b.dailyUsageKwh).toBe(15);
    expect(b.annualUsageKwh).toBe(5475);
    expect(b.annualSource).toBe("period");
    expect(b.usageRate).toBeCloseTo(0.32);
    expect(b.feedInRate).toBeCloseTo(0.033);
  });

  it("prefers the bill's own 12-month history", () => {
    const b = summariseBill({ isElectricityBill: true, periodDays: 90, usageKwh: 2000, annualUsageKwh: 6200 }) as BillSummary;
    expect(b.annualUsageKwh).toBe(6200);
    expect(b.annualSource).toBe("history");
  });

  it("rejects non-electricity bills and missing usage", () => {
    expect(summariseBill({ isElectricityBill: false })).toBe("not-a-bill");
    expect(summariseBill({ isElectricityBill: true, periodDays: 90, usageKwh: null })).toBe("unreadable");
    expect(summariseBill({ isElectricityBill: true, periodDays: 90, usageKwh: -5 })).toBe("unreadable");
  });

  it("flags existing solar", () => {
    expect((summariseBill({ isElectricityBill: true, annualUsageKwh: 5000, exportedKwh: 300 }) as BillSummary).hasSolar).toBe(true);
  });
});

describe("recommendSystem", () => {
  it("sizes solar without a battery to what the home uses, no more", () => {
    const { tiers, usage } = recommendSystem(base, analysis, bill);
    const panels = tiers.essential.config.panelCount;
    const kwhPerPanelYear = (ASSUMPTIONS.panelWatts / 1000) * ASSUMPTIONS.dailyYieldKwhPerKw * 365;
    expect(panels * kwhPerPanelYear).toBeGreaterThanOrEqual(usage.annualKwh);
    expect((panels - 1) * kwhPerPanelYear).toBeLessThan(usage.annualKwh);
  });

  it("adds generation to charge a battery, now or planned", () => {
    const { tiers, usage } = recommendSystem(base, analysis, bill);
    const kwhPerPanelYear = (ASSUMPTIONS.panelWatts / 1000) * ASSUMPTIONS.dailyYieldKwhPerKw * 365;
    expect(tiers.recommended.config.panelCount).toBeGreaterThan(tiers.essential.config.panelCount);
    expect(tiers.recommended.config.panelCount * kwhPerPanelYear).toBeGreaterThanOrEqual(usage.annualKwh * ASSUMPTIONS.batteryReadySolar);
    expect(tiers.independence.config.panelCount).toBe(tiers.recommended.config.panelCount);

    // Planning a battery later: Essential gets the same battery-ready solar, without the battery.
    const planned = recommendSystem({ ...base, batteryPlanned: true }, analysis, bill).tiers.essential.config;
    expect(planned.panelCount).toBe(tiers.recommended.config.panelCount);
    expect(planned.batteryKwh).toBe(0);
  });

  it("grows with a bigger bill and a planned EV", () => {
    const small = recommendSystem(base, analysis, bill).tiers.essential.config.panelCount;
    const ev = recommendSystem({ ...base, evPlanned: true }, analysis, bill);
    expect(ev.usage.annualKwh - bill.annualUsageKwh).toBe(ASSUMPTIONS.evAnnualKwh);
    expect(ev.tiers.essential.config.panelCount).toBeGreaterThan(small);
  });

  it("differs by battery only: none, sized to evening use, one size up", () => {
    const { tiers, usage } = recommendSystem(base, analysis, bill);
    expect(tiers.essential.config.batteryKwh).toBe(0);
    expect(tiers.recommended.config.batteryKwh * ASSUMPTIONS.batteryUsableShare).toBeGreaterThanOrEqual(
      usage.dailyKwh * usage.eveningShare,
    );
    expect(tiers.independence.config.batteryKwh).toBeGreaterThan(tiers.recommended.config.batteryKwh);
  });

  it("goes one battery size up for backup", () => {
    const usage = usageBasis(bill, base);
    expect(batteryNeeded(usage, true)).toBeGreaterThan(batteryNeeded(usage, false));
  });

  it("stays within panel and roof limits", () => {
    const huge = summariseBill({ isElectricityBill: true, annualUsageKwh: 40000 }) as BillSummary;
    for (const t of Object.values(recommendSystem(base, { ...analysis, maxPanels: 24 }, huge).tiers)) {
      expect(t.config.panelCount).toBeLessThanOrEqual(24);
    }
  });

  it("adds an EV charger only for EV households", () => {
    expect(recommendSystem({ ...base, ev: true }, analysis, bill).tiers.recommended.config.evCharger).toBe(true);
    expect(recommendSystem({ ...base, evPlanned: true }, analysis, bill).tiers.recommended.config.evCharger).toBe(true);
    expect(recommendSystem(base, analysis, bill).tiers.recommended.config.evCharger).toBe(false);
  });
});

describe("priceSystem", () => {
  it("applies rebates, includes add-ons and keeps a fixed deposit", () => {
    const config = { panelCount: 30, batteryKwh: 13.5, evCharger: true };
    const plain = priceSystem(config, { storeys: "double" });
    const withAddOns = priceSystem(config, { storeys: "double" }, ["heat-pump", "smart-home"]);
    expect(plain.total).toBe(plain.gross - plain.rebates);
    expect(plain.deposit).toBe(499);
    expect(plain.lines.some((l) => l.label.includes("Double-storey"))).toBe(true);
    const addOnTotal = ADD_ONS.filter((a) => a.id === "heat-pump" || a.id === "smart-home").reduce((s, a) => s + a.price, 0);
    expect(withAddOns.total - plain.total).toBe(addOnTotal);
  });

  it("produces a positive payback estimate", () => {
    const config = { panelCount: 20, batteryKwh: 0, evCharger: false };
    const outcome = estimateOutcome(config, usageBasis(bill, base), priceSystem(config, analysis));
    expect(outcome.annualSavings).toBeGreaterThan(0);
    expect(outcome.paybackYears).toBeGreaterThan(0);
  });

  it("describes a system in plain language", () => {
    expect(describeSystem({ panelCount: 30, batteryKwh: 13.5, evCharger: true })).toBe(
      "13.2 kW solar + 13.5 kWh battery + EV charger + monitoring",
    );
  });
});

describe("rankInstallers", () => {
  it("only returns installers servicing the postcode, best first", () => {
    // Ballarat: Primero (preferred, statewide) then the local specialist.
    expect(rankInstallers(INSTALLERS, "3350").map((r) => r.installer.id)).toEqual(["ins_primero", "ins_goldfields"]);
    const brighton = rankInstallers(INSTALLERS, "3186");
    expect(brighton[0].installer.id).toBe("ins_primero");
    expect(brighton.map((r) => r.installer.id)).toContain("ins_bayside");
    // Non-preferred installers are ordered by score.
    const base = INSTALLERS.find((i) => i.id === "ins_bayside")!;
    const ranked = rankInstallers(
      [
        { ...base, id: "weaker", rating: 4.2 },
        { ...base, id: "stronger", rating: 5 },
      ],
      "3186",
    );
    expect(ranked.map((r) => r.installer.id)).toEqual(["stronger", "weaker"]);
    // Outside Victoria, only installers that serve the postcode are returned.
    expect(rankInstallers(INSTALLERS, "2000")).toEqual([]);
  });

  it("never makes performance claims for installers without verified figures", () => {
    const primero = rankInstallers(INSTALLERS, "3000").find((r) => r.installer.id === "ins_primero")!;
    expect(primero.reasons.join(" ")).not.toMatch(/%|RENUABL customers/);
    expect(primero.reasons).toContain("Rated 4.7 from 141 Google reviews.");
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
  it("offers days, not times: every install arrives 7am–9am", () => {
    expect(INSTALL_ARRIVAL.label).toBe("7am–9am");
    expect(buildAvailability("ins_primero", new Date(2026, 8, 1)).every((d) => d.windows.join() === INSTALL_ARRIVAL.id)).toBe(true);
  });

  it("respects lead time and skips Sundays", () => {
    const from = new Date(2026, 8, 1);
    const days = buildAvailability("ins_primero", from);
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

describe("greeting", () => {
  it("follows Melbourne time", () => {
    expect(greeting(new Date("2026-09-27T22:00:00Z"))).toBe("Good morning"); // 8am AEST
    expect(greeting(new Date("2026-09-28T04:00:00Z"))).toBe("Good afternoon"); // 2pm
    expect(greeting(new Date("2026-09-28T09:30:00Z"))).toBe("Good evening"); // 7:30pm
  });
});

describe("checkout line items", () => {
  it("marks optional products removable and the core system fixed", () => {
    const price = priceSystem({ panelCount: 29, batteryKwh: 20, evCharger: true }, { storeys: "single" }, ["heat-pump"]);
    const removable = Object.fromEntries(price.lines.map((l) => [l.id, l.removable]));
    expect(removable).toEqual({ solar: false, battery: true, "ev-charger": true, monitoring: false, "heat-pump": true });
  });
});

describe("RENUABL Care", () => {
  it("prices monthly and yearly billing, with yearly cheaper", () => {
    expect(carePrice("monthly")).toBe(19);
    expect(carePrice("yearly")).toBe(199);
    expect(careYearlySaving()).toBe(29);
    expect(carePriceLabel("yearly")).toBe("$199/year");
  });
});

describe("suggestedAdditions", () => {
  it("offers removed or missing optional items, never ones already chosen", () => {
    const rec = { panelCount: 29, batteryKwh: 13.5, evCharger: true };
    const ids = suggestedAdditions({ ...rec, batteryKwh: 0 }, rec, ["heat-pump"]).map((s) => s.id);
    expect(ids).toContain("battery");
    expect(ids).not.toContain("ev-charger");
    expect(ids).not.toContain("heat-pump");
    expect(ids).toContain("smart-home");
  });
});

describe("HubSpot booking", () => {
  it("accepts only https HubSpot meetings links", () => {
    expect(parseHubspotMeetingsUrl("https://meetings.hubspot.com/renuabl/confirmation")?.hostname).toBe("meetings.hubspot.com");
    expect(parseHubspotMeetingsUrl("https://meetings-ap1.hubspot.com/renuabl")).not.toBeNull();
    expect(parseHubspotMeetingsUrl("http://meetings.hubspot.com/renuabl")).toBeNull();
    expect(parseHubspotMeetingsUrl("https://evil.example.com/hubspot.com")).toBeNull();
    expect(parseHubspotMeetingsUrl(undefined)).toBeNull();
  });

  it("builds an embed link with prefill", () => {
    const src = hubspotEmbedSrc(new URL("https://meetings.hubspot.com/renuabl"), { email: "sarah@example.com" });
    expect(src).toBe("https://meetings.hubspot.com/renuabl?embed=true&email=sarah%40example.com");
  });

  it("recognises HubSpot's booked message only from HubSpot", () => {
    expect(isHubspotBookedMessage("https://meetings.hubspot.com", { meetingBookSucceeded: true })).toBe(true);
    expect(isHubspotBookedMessage("https://attacker.example", { meetingBookSucceeded: true })).toBe(false);
    expect(isHubspotBookedMessage("https://meetings.hubspot.com", { other: 1 })).toBe(false);
  });
});

describe("RENUABL Care included with the top package", () => {
  it("is free for 12 months only on the Maximum package", () => {
    expect(careIncludedFor("independence")).toBe(true);
    expect(careIncludedFor("recommended")).toBe(false);
    expect(careIncludedFor("essential")).toBe(false);
    expect(careIncludedValue()).toBe(199);
    expect(CARE_FREE_MONTHS).toBe(12);
  });
});

describe("service visits", () => {
  it("offers weekday slots from two days out", () => {
    const from = new Date(2026, 8, 28); // Monday
    const days = buildServiceAvailability("ins_primero", from);
    expect(days.length).toBeGreaterThan(5);
    for (const d of days) {
      const date = fromISODate(d.date);
      expect([0, 6]).not.toContain(date.getDay());
      expect(date.getTime()).toBeGreaterThanOrEqual(new Date(2026, 8, 30).getTime());
      expect(d.windows.every((w) => SERVICE_WINDOWS.some((s) => s.id === w))).toBe(true);
    }
  });

  it("treats annual checks as maintenance, faults as possible warranty", () => {
    expect(mayBeWarranty("health-check")).toBe(false);
    expect(mayBeWarranty("battery")).toBe(true);
  });
});

describe("system options", () => {
  it("are shown Essential, Recommended, Maximum", () => {
    expect(Object.values(TIER_LABELS)).toEqual(["Essential", "Recommended", "Maximum"]);
  });
});

describe("confirmation call booking", () => {
  it("offers weekday times from tomorrow, all before the install date", () => {
    const days = buildCallAvailability("2026-09-28", "2026-10-06");
    expect(days.length).toBeGreaterThan(3);
    for (const d of days) {
      expect(d.date > "2026-09-28" && d.date < "2026-10-06").toBe(true);
      expect([0, 6]).not.toContain(fromISODate(d.date).getDay());
      expect(d.times.length).toBeGreaterThan(0);
    }
  });

  it("formats times plainly", () => {
    expect(formatCallTime("09:00")).toBe("9am");
    expect(formatCallTime("13:30")).toBe("1:30pm");
    expect(formatCallTime("12:00")).toBe("12pm");
  });
});
