import { describe, expect, it } from "vitest";
import { advanceStatus, nextFieldStatus } from "./job-status";
import { buildCallAvailability, formatCallTime, hubspotEmbedSrc, isHubspotBookedMessage, parseHubspotMeetingsUrl } from "./booking";
import { CARE_ENABLED, CARE_FREE_MONTHS, careIncludedFor, careIncludedValue, carePrice, carePriceLabel, careYearlySaving } from "./care";
import { greeting, marketDateTime, todayInMarket } from "./market";
import { rankInstallers } from "./matching";
import {
  ADD_ONS,
  ASSUMPTIONS,
  describeSystem,
  batteryNeeded,
  panelsToKw,
  topUpPanels,
  estimateOutcome,
  priceSystem,
  panelsLaidFlat,
  recommendSystem,
  suggestedAdditions,
  TIER_LABELS,
  usageBasis,
} from "./recommendation";
import { summariseBill, type BillSummary } from "./bill";
import { normaliseMobile, validateContact } from "./contact";
import { BOS, PANEL, RACKING } from "./catalogue";
import {
  COSTING,
  acIsolatorFor,
  acOutputAmps,
  arrayKw,
  batteryInstallCost,
  billOfMaterials,
  railLengths,
  selectInverter,
  sellPrice,
} from "./costing";
import { REBATE_RATES, batteryFactor, batteryStcs, deemingYears, rebatesFor, solarStcs, taperedKwh } from "./rebates";
import { zoneRating } from "./zone-ratings";
import { HYBRID_INVERTERS, STRING_INVERTERS } from "./catalogue";
import { EXPAND_DISCLAIMER, existingSolarQuestions, expandNote, isAboutComplete, realAnnualUse, solarSituation } from "./existing-solar";
import { INSTALL_ARRIVAL, buildAvailability, fromISODate } from "./scheduling";
import { SERVICE_WINDOWS, buildServiceAvailability, mayBeWarranty } from "./service";
import type { EnergyProfile, HomeAnalysis } from "./types";
import { SAMPLE_ADDRESSES } from "@/lib/mock/addresses";
import { INSTALLERS } from "@/lib/mock/installers";

const base: EnergyProfile = { ev: false, evPlanned: false, wantsBattery: false, backup: false };
const analysis: HomeAnalysis = { storeys: "single", roof: "Colorbond", orientation: "North", maxPanels: 36 };
const site = { storeys: "single" as const, roof: "tin" as const, phase: "single" as const };
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
  it("never goes below the 5 kW minimum system", () => {
    const tiny = summariseBill({ isElectricityBill: true, annualUsageKwh: 2000 }) as BillSummary;
    const { essential } = recommendSystem(base, analysis, tiny).tiers;
    expect(panelsToKw(essential.config.panelCount)).toBeGreaterThanOrEqual(ASSUMPTIONS.minSystemKw);
    expect(panelsToKw(essential.config.panelCount - 1)).toBeLessThan(ASSUMPTIONS.minSystemKw);
  });

  it("sizes solar without a battery to what the home uses, no more", () => {
    const big = summariseBill({ isElectricityBill: true, annualUsageKwh: 9000 }) as BillSummary;
    const { tiers, usage } = recommendSystem(base, analysis, big);
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
    const planned = recommendSystem({ ...base, wantsBattery: true }, analysis, bill).tiers.essential.config;
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
    const plain = priceSystem(config, { storeys: "double", roof: "tile", phase: "single" });
    const withAddOns = priceSystem(config, { storeys: "double", roof: "tile", phase: "single" }, ["heat-pump", "smart-home"]);
    expect(plain.total).toBe(plain.gross - plain.rebates);
    expect(plain.deposit).toBe(499);
    expect(plain.bom.find((l) => l.description === "Double-storey installation")?.total).toBe(400);
    const addOnTotal = ADD_ONS.filter((a) => a.id === "heat-pump" || a.id === "smart-home").reduce((s, a) => s + a.price, 0);
    expect(withAddOns.total - plain.total).toBe(addOnTotal);
  });

  it("produces a positive payback estimate", () => {
    const config = { panelCount: 20, batteryKwh: 0, evCharger: false };
    const outcome = estimateOutcome(config, usageBasis(bill, base), priceSystem(config, site));
    expect(outcome.annualSavings).toBeGreaterThan(0);
    expect(outcome.paybackYears).toBeGreaterThan(0);
  });

  it("describes a system in plain language", () => {
    expect(describeSystem({ panelCount: 30, batteryKwh: 16, evCharger: true })).toBe(
      "14.3 kW solar + 16 kWh battery + EV charger + monitoring",
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
    const price = priceSystem({ panelCount: 20, batteryKwh: 16, evCharger: true }, site, ["heat-pump"]);
    const removable = Object.fromEntries(price.lines.map((l) => [l.id, l.removable]));
    expect(removable).toEqual({ solar: false, battery: true, "ev-charger": true, "heat-pump": true });
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
    const ids = suggestedAdditions({ ...rec, batteryKwh: 0 }, rec, ["heat-pump"], site).map((s) => s.id);
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
  it("is switched off for now (phase 2), so no package includes it", () => {
    expect(CARE_ENABLED).toBe(false);
    for (const t of ["essential", "recommended", "independence"]) expect(careIncludedFor(t)).toBe(false);
  });

  it.skipIf(!CARE_ENABLED)("is free for 12 months only on the Maximum package", () => {
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

describe("existing solar", () => {
  // A home with solar: buys ~12 kWh a day from the grid, exports ~6 kWh a day.
  const solarBill = summariseBill({
    isElectricityBill: true,
    periodDays: 90,
    usageKwh: 1080,
    exportedKwh: 540,
    usageRate: 0.3,
    feedInRate: 0.04,
  }) as BillSummary;

  it("names the inverter once it's been read from photos", () => {
    expect(expandNote(null)).toBe(EXPAND_DISCLAIMER);
    const note = expandNote({ brand: "Fronius", model: "Primo 5.0-1", ratedKw: 5, phase: "single", hybrid: false });
    expect(note).toContain("Your current inverter: Fronius Primo 5.0-1 · 5 kW");
    expect(note).not.toContain("don't know");
  });

  it("reads daily exports from the bill", () => {
    expect(solarBill.hasSolar).toBe(true);
    expect(solarBill.exportedDailyKwh).toBe(6);
  });

  it("asks the size, and replace-or-expand only when unsure", () => {
    expect(existingSolarQuestions(bill, {})).toEqual({ size: false, plan: false });
    expect(existingSolarQuestions(solarBill, {})).toEqual({ size: true, plan: false });
    expect(existingSolarQuestions(solarBill, { existingSize: "unsure" })).toEqual({ size: true, plan: true });
    expect(solarSituation(solarBill, { existingSize: "5-10" })).toBe("expand");
    expect(solarSituation(solarBill, { existingSize: "unsure", existingPlan: "replace" })).toBe("replace");
    expect(solarSituation(bill, {})).toBe("new");
  });

  it("is only complete once the solar questions are answered", () => {
    const answers = {
      ev: false,
      evPlanned: false,
      backup: false,
      roofType: "tin" as const,
      storeys: "single" as const,
      phase: "single" as const,
    };
    expect(isAboutComplete(bill, { ev: false, evPlanned: false, backup: false, wantsBattery: false })).toBe(false); // roof not answered
    expect(isAboutComplete(solarBill, answers)).toBe(false);
    expect(isAboutComplete(solarBill, { ...answers, existingSize: "unsure" })).toBe(false);
    // Expanding: every option has a battery, so the battery question isn't asked.
    expect(isAboutComplete(solarBill, { ...answers, existingSize: "unsure", existingPlan: "expand" })).toBe(true);
    expect(isAboutComplete(solarBill, { ...answers, existingSize: "unsure", existingPlan: "replace" })).toBe(false);
    expect(isAboutComplete(solarBill, { ...answers, existingSize: "unsure", existingPlan: "replace", wantsBattery: true })).toBe(true);
    expect(isAboutComplete(bill, { ...answers, wantsBattery: false })).toBe(true);
  });

  it("expanding keeps the existing panels and sells a battery in every option", () => {
    const { tiers, usage } = recommendSystem({ ...base, existingSize: "5-10" }, analysis, solarBill);
    expect(usage.existingSolar).toEqual({ exportedDailyKwh: 6 });
    for (const t of Object.values(tiers)) {
      expect(t.config.existingSolar).toBe(true);
      expect(t.config.batteryKwh).toBeGreaterThan(0);
      expect(t.config.panelCount).toBeLessThan(ASSUMPTIONS.minPanels);
    }
    expect(tiers.essential.config.panelCount).toBe(0);
    expect(tiers.essential.config.batteryKwh).toBeLessThanOrEqual(tiers.recommended.config.batteryKwh);
    expect(tiers.independence.config.batteryKwh).toBeGreaterThan(tiers.recommended.config.batteryKwh);
  });

  it("adds panels only when exports can't fill the battery", () => {
    const usage = usageBasis(solarBill, { ...base, existingSize: "5-10" });
    const plenty = { ...usage, existingSolar: { exportedDailyKwh: 30 } };
    expect(topUpPanels(plenty, 13.5, analysis)).toBe(0);
    const little = { ...usage, existingSolar: { exportedDailyKwh: 1 } };
    expect(topUpPanels(little, 13.5, analysis)).toBeGreaterThan(0);
  });

  it("prices an expansion without a solar line when no panels are added, and saves money", () => {
    const { tiers, usage } = recommendSystem({ ...base, existingSize: "5-10" }, analysis, solarBill);
    const price = priceSystem(tiers.essential.config, site);
    expect(price.lines.some((l) => l.id === "solar")).toBe(false);
    expect(describeSystem(tiers.essential.config)).toMatch(/^Your existing solar \+ \d+(\.\d)? kWh battery/);
    expect(estimateOutcome(tiers.essential.config, usage, price).annualSavings).toBeGreaterThan(0);
  });

  it("replacing sizes to estimated real use: grid purchases plus solar used at home", () => {
    const replace = { ...base, existingSize: "unsure" as const, existingPlan: "replace" as const };
    const { usage, tiers } = recommendSystem(replace, analysis, solarBill);
    expect(usage.existingSolar).toBeNull();
    expect(usage.annualKwh).toBe(realAnnualUse(solarBill));
    expect(usage.annualKwh).toBeGreaterThan(solarBill.annualUsageKwh);
    expect(tiers.essential.config.existingSolar).toBeUndefined();
    expect(tiers.essential.why[0]).toBe("Replaces your current solar system");
  });
});

describe("costing from the supplier price list", () => {
  const input = {
    panelCount: 14,
    batteryKwh: 0,
    evCharger: false,
    roof: "tin" as const,
    storeys: "single" as const,
    phase: "single" as const,
    addOns: [],
  };
  const skus = (lines: ReturnType<typeof billOfMaterials>) => lines.map((l) => l.sku);

  it("picks the smallest inverter the array may connect to (array <= 133% of its rating)", () => {
    expect(selectInverter(6.65, STRING_INVERTERS).kw).toBe(5); // 6.65 <= 5 x 1.33
    expect(selectInverter(6.7, STRING_INVERTERS).kw).toBe(8);
    expect(selectInverter(10.6, HYBRID_INVERTERS).kw).toBe(8); // 10.6 <= 8 x 1.33 = 10.64
    expect(selectInverter(10.7, HYBRID_INVERTERS).kw).toBe(10);
    for (const kw of [5.2, 7.1, 9.5, 12.8]) {
      const inv = selectInverter(kw, HYBRID_INVERTERS);
      expect(kw).toBeLessThanOrEqual(inv.kw * COSTING.maxArrayToInverter);
    }
  });

  it("never sizes an array beyond what the largest inverter allows", () => {
    expect(arrayKw(ASSUMPTIONS.maxPanelsSinglePhase)).toBeLessThanOrEqual(10 * COSTING.maxArrayToInverter);
    expect(arrayKw(ASSUMPTIONS.maxPanelsSinglePhase + 1)).toBeGreaterThan(10 * COSTING.maxArrayToInverter);
    expect(arrayKw(ASSUMPTIONS.maxPanels)).toBeLessThanOrEqual(15 * COSTING.maxArrayToInverter);
  });

  it("allows (panel width + 0.1 m) x 2 of rail per panel, bought in 4.8 m lengths", () => {
    const r = railLengths(14);
    expect(r.metres).toBeCloseTo(14 * 2 * (PANEL.widthM + 0.1), 2);
    expect(r.lengths).toBe(Math.ceil(r.metres / RACKING.rail.lengthM));
  });

  it("uses tin or tile kits (one per 2 kW) by roof type", () => {
    const tin = billOfMaterials(input);
    const tile = billOfMaterials({ ...input, roof: "tile" });
    expect(skus(tin)).toContain("ANTTIN20");
    expect(skus(tile)).toContain("ANTTILE20");
    expect(tin.find((l) => l.sku === "ANTTIN20")!.qty).toBe(Math.ceil(arrayKw(14) / 2));
    // "Not sure" is quoted as tile (the dearer kit) until the call.
    expect(skus(billOfMaterials({ ...input, roof: "unsure" }))).toContain("ANTTILE20");
  });

  it("charges solar installation at 30c per watt", () => {
    const labour = billOfMaterials(input).find((l) => l.description.startsWith("Solar installation"))!;
    expect(labour.total).toBeCloseTo(arrayKw(14) * 1000 * 0.3, 2);
  });

  it("uses a string inverter without a battery, the Sigenergy controller with one (or when one is planned)", () => {
    expect(skus(billOfMaterials(input)).some((s) => s?.startsWith("SGWSG"))).toBe(true);
    const withBattery = billOfMaterials({ ...input, batteryKwh: 16 });
    expect(skus(withBattery).some((s) => s?.startsWith("SGWSG"))).toBe(false);
    expect(skus(withBattery).some((s) => s?.startsWith("SIG1104"))).toBe(true);
    expect(withBattery.find((l) => l.sku === "SIG11130001")!.qty).toBe(2);
    expect(skus(billOfMaterials({ ...input, batteryReady: true })).some((s) => s?.startsWith("SIG1104"))).toBe(true);
  });

  it("charges battery installation per stack, with extra modules at $1,800 / 6 each", () => {
    expect(batteryInstallCost(1)).toBe(1800);
    expect(batteryInstallCost(6)).toBe(1800);
    expect(batteryInstallCost(7)).toBe(2100);
    expect(batteryInstallCost(9)).toBe(2700);
  });

  it("includes RENUABL's balance of system", () => {
    const solar = billOfMaterials(input);
    const bySku = (lines: ReturnType<typeof billOfMaterials>, sku: string) => lines.find((l) => l.sku === sku);
    expect(bySku(solar, "MMELABELDC")!.qty).toBe(1);
    expect(bySku(solar, "NEAMC4EVO2")!.qty).toBe(10);
    expect(bySku(solar, "NHPNL140L")!.qty).toBe(1);
    // Four clips per panel, rounded up to whole packs.
    const clips = bySku(solar, "MTLCLIP-M4X2/SS")!.qty;
    expect(clips % BOS.panelClip.packSize).toBe(0);
    expect(clips).toBeGreaterThanOrEqual(14 * 4);
    expect(bySku(solar, "AWMPVBATTERY")).toBeUndefined();
    // Solar and battery: both the DC and the battery label kits.
    const both = billOfMaterials({ ...input, batteryKwh: 8 });
    expect(bySku(both, "MMELABELDC")).toBeDefined();
    expect(bySku(both, "AWMPVBATTERY")).toBeDefined();
  });

  it("adds $400 for double storey and $150 only when a three-phase inverter is fitted", () => {
    const labour = (lines: ReturnType<typeof billOfMaterials>, d: string) => lines.find((l) => l.description === d)?.total;
    expect(labour(billOfMaterials(input), "Double-storey installation")).toBeUndefined();
    expect(labour(billOfMaterials({ ...input, storeys: "double" }), "Double-storey installation")).toBe(400);
    expect(labour(billOfMaterials(input), "Three-phase inverter installation")).toBeUndefined();
    const three = billOfMaterials({ ...input, phase: "three" });
    expect(labour(three, "Three-phase inverter installation")).toBe(150);
    expect(three.some((l) => l.sku === "SGWSG5.0RT")).toBe(true);
    expect(three.some((l) => l.sku === "NHPNL340L")).toBe(true);
  });

  it("sizes the AC isolator to the inverter's output", () => {
    expect(acOutputAmps(5, "single")).toBeCloseTo(21.7, 1);
    expect(acOutputAmps(8, "single")).toBeCloseTo(34.8, 1);
    // Single phase: 40 A 2-pole up to 32 A output (5 and 6 kW), 63 A above (8 and 10 kW).
    expect(acIsolatorFor(5, "single").sku).toBe("NHPNL140L");
    expect(acIsolatorFor(6, "single").sku).toBe("NHPNL140L");
    expect(acIsolatorFor(8, "single")).toBe(BOS.acIsolator63);
    expect(acIsolatorFor(10, "single")).toBe(BOS.acIsolator63);
    // Three phase: 40 A 3-pole is ample for residential sizes (15 kW ≈ 21.7 A a phase).
    expect(acIsolatorFor(15, "three").sku).toBe("NHPNL340L");
    // In the bill of materials: 22 panels (10.45 kW) need an 8 kW single-phase inverter, so the 63 A.
    const big = billOfMaterials({ ...input, panelCount: 22 });
    expect(big.some((l) => l.sku === BOS.acIsolator63.sku)).toBe(true);
    expect(big.some((l) => l.sku === "NHPNL140L")).toBe(false);
  });

  it("prices flat roofs with the tin kit and Kliplok interfaces (2 a panel + 2 per array), no tilt when laid flat", () => {
    const flat = billOfMaterials({ ...input, roof: "flat" });
    expect(flat.find((l) => l.sku === "ANTTIN20")!.qty).toBe(Math.ceil(arrayKw(input.panelCount) / 2));
    expect(flat.find((l) => l.sku === "CLNER-I-34")!.qty).toBe(input.panelCount * 2 + COSTING.assumedArrays * 2);
    expect(flat.some((l) => l.sku === "ANTTILT10/15")).toBe(false);
    expect(flat.some((l) => l.description.startsWith("Tilt frame"))).toBe(false);
    // Pitched roofs don't get Kliplok interfaces.
    expect(billOfMaterials(input).some((l) => l.sku === "CLNER-I-34")).toBe(false);
  });

  it("adds tilt kits and $15 a panel when tilted, keeping the tin kit and Kliplok", () => {
    const tilted = billOfMaterials({ ...input, roof: "flat", tilt: true });
    expect(tilted.find((l) => l.sku === "ANTTILT10/15")!.qty).toBe(Math.ceil(arrayKw(input.panelCount) / 2));
    expect(tilted.some((l) => l.sku === "ANTTIN20")).toBe(true);
    expect(tilted.some((l) => l.sku === "CLNER-I-34")).toBe(true);
    expect(tilted.find((l) => l.description.startsWith("Tilt frame installation"))!.total).toBe(input.panelCount * 15);
    // "tilt" only means something on a flat roof.
    expect(billOfMaterials({ ...input, roof: "tin", tilt: true }).some((l) => l.sku === "ANTTILT10/15")).toBe(false);
  });

  it("buys enough mounting kits for the whole array", () => {
    for (const panelCount of [11, 14, 21, 30]) {
      const kits = billOfMaterials({ ...input, panelCount }).find((l) => l.sku === "ANTTIN20" || l.sku === "ANTTILE20")!.qty;
      expect(kits * 2).toBeGreaterThanOrEqual(arrayKw(panelCount));
    }
  });

  it("sizes panels laid flat a little larger, since they make less power", () => {
    const bill = summariseBill({ isElectricityBill: true, periodDays: 91, usageKwh: 3000 }) as BillSummary;
    const pitched = recommendSystem({ ...base, roofType: "tin" }, analysis, bill).tiers.essential.config.panelCount;
    const laidFlat = recommendSystem({ ...base, roofType: "flat" }, analysis, bill).tiers.essential.config.panelCount;
    const tilted = recommendSystem({ ...base, roofType: "flat", flatMount: "tilt" }, analysis, bill).tiers.essential.config.panelCount;
    expect(laidFlat).toBeGreaterThan(pitched);
    expect(tilted).toBe(pitched);
    expect(panelsLaidFlat({ roofType: "flat" })).toBe(true);
    expect(panelsLaidFlat({ roofType: "flat", flatMount: "tilt" })).toBe(false);
  });

  it("charges $1,000 ex GST to install an EV charger", () => {
    const ev = billOfMaterials({ ...input, evCharger: true }).find((l) => l.description === "EV charger installation");
    expect(ev!.total).toBe(1000);
  });

  it("buys panel clips in packs of 100", () => {
    expect(billOfMaterials({ ...input, panelCount: 26 }).find((l) => l.sku === "MTLCLIP-M4X2/SS")!.qty).toBe(200);
  });

  it("adds a 20% margin and GST to supplier cost", () => {
    expect(sellPrice(1000)).toBe(1320);
  });

  it("prices the customer's lines from the bill of materials, less rebates", () => {
    const config = { panelCount: 14, batteryKwh: 16, evCharger: false };
    const price = priceSystem(config, site);
    const solarCost = price.bom.filter((l) => l.group === "solar").reduce((s, l) => s + l.total, 0);
    expect(price.lines.find((l) => l.id === "solar")!.amount).toBe(sellPrice(solarCost));
    expect(price.rebates).toBe(rebatesFor(config).total);
    expect(price.total).toBe(price.gross - price.rebates);
  });
});

describe("contact details", () => {
  it("normalises Australian mobiles", () => {
    expect(normaliseMobile("0412 345 678")).toBe("+61412345678");
    expect(normaliseMobile("+61 412 345 678")).toBe("+61412345678");
    expect(normaliseMobile("(04) 1234-5678")).toBe("+61412345678");
    expect(normaliseMobile("03 9555 1234")).toBeNull();
    expect(normaliseMobile("041234567")).toBeNull();
  });

  it("validates and tidies the details", () => {
    const ok = validateContact({ firstName: " Sarah ", lastName: "Chen", mobile: "0412345678", email: "Sarah@Example.com " });
    expect(ok).toEqual({ contact: { firstName: "Sarah", lastName: "Chen", mobile: "+61412345678", email: "sarah@example.com" } });
    const bad = validateContact({ firstName: "", lastName: "Chen", mobile: "123", email: "nope" });
    expect("errors" in bad && Object.keys(bad.errors).sort()).toEqual(["email", "firstName", "mobile"]);
  });
});

describe("rebates", () => {
  const config = { panelCount: 14, batteryKwh: 16 };
  const vic = { state: "VIC", postcode: "3150", installDate: "2026-10-05", solarVicRebate: true, solarVicLoan: false };

  it("uses the CER's zone for the postcode and the deeming years for the install year", () => {
    expect(zoneRating("3150")).toEqual({ zone: 4, rating: 1.185 }); // Glen Waverley
    expect(zoneRating("3500")).toEqual({ zone: 3, rating: 1.382 }); // Mildura
    expect(deemingYears("2026-10-05")).toBe(5);
    expect(deemingYears("2027-02-01")).toBe(4);
    expect(solarStcs(14, "3150", "2026-10-05")).toBe(Math.floor(arrayKw(14) * 1.185 * 5));
    expect(solarStcs(14, "3500", "2026-10-05")).toBe(Math.floor(arrayKw(14) * 1.382 * 5));
  });

  it("uses the battery factor for the install date, tapered by size and capped at 50 kWh", () => {
    expect(batteryFactor("2026-04-30")).toBe(8.4);
    expect(batteryFactor("2026-10-05")).toBe(6.8);
    expect(batteryFactor("2027-07-01")).toBe(5.2);
    expect(taperedKwh(8)).toBe(8);
    expect(taperedKwh(24)).toBeCloseTo(14 + 10 * 0.6);
    expect(taperedKwh(40)).toBeCloseTo(14 + 14 * 0.6 + 12 * 0.15);
    expect(taperedKwh(60)).toBeCloseTo(14 + 14 * 0.6 + 22 * 0.15);
    expect(batteryStcs(24, "2026-10-05")).toBe(Math.floor((14 + 10 * 0.6) * 6.8)); // 136
  });

  it("shows each federal rebate as its own line", () => {
    const { lines, total } = rebatesFor(config, vic);
    expect(lines.map((l) => l.id)).toEqual(["stc-solar", "stc-battery", "sv-solar"]);
    expect(lines[0].amount).toBe(Math.round(solarStcs(14, "3150", "2026-10-05") * REBATE_RATES.stc.price));
    expect(total).toBe(lines.reduce((s, l) => s + l.amount, 0));
  });

  it("offers Solar Victoria only for Victorian homes that opt in, capped at 50% of the solar cost after STCs", () => {
    expect(rebatesFor(config, { ...vic, state: "NSW" }).lines.some((l) => l.id === "sv-solar")).toBe(false);
    expect(rebatesFor(config, { ...vic, solarVicRebate: false }).lines.some((l) => l.id === "sv-solar")).toBe(false);
    expect(rebatesFor(config, vic, REBATE_RATES, 10_000).lines.find((l) => l.id === "sv-solar")!.amount).toBe(1400);
    const stc = rebatesFor(config, vic).lines[0].amount;
    expect(rebatesFor(config, vic, REBATE_RATES, stc + 2000).lines.find((l) => l.id === "sv-solar")!.amount).toBe(1000);
    // Not for extra panels on an existing system, and no Solar Victoria battery rebate.
    expect(rebatesFor({ ...config, existingSolar: true }, vic).lines.some((l) => l.id === "sv-solar")).toBe(false);
    expect(rebatesFor(config, vic).lines.some((l) => l.id === "sv-battery")).toBe(false);
  });

  it("applies the interest-free loan to the upfront cost, not the price", () => {
    const withLoan = priceSystem({ panelCount: 14, batteryKwh: 0, evCharger: false }, site, [], { ...vic, solarVicLoan: true });
    const without = priceSystem({ panelCount: 14, batteryKwh: 0, evCharger: false }, site, [], vic);
    expect(withLoan.total).toBe(without.total);
    expect(withLoan.loan).toBe(1400);
    expect(withLoan.outOfPocket).toBe(without.total - 1400);
  });
});

describe("battery STCs for a 48 kWh battery in October 2026 (checked by hand)", () => {
  it("gets 172 certificates, not 403", () => {
    // 14 × 100% + 14 × 60% + 20 × 15% = 25.4 kWh × 6.8 = 172.72 → 172
    expect(batteryStcs(48, "2026-10-05")).toBe(172);
  });
});
