import { describe, expect, it } from "vitest";
import { revoContext, revoLine } from "./revo";
import { LEAD_TIME_DAYS, SOLAR_VIC_LEAD_DAYS, buildAvailability, installLeadDays, toISODate, addDays } from "./scheduling";

describe("install dates and Solar Victoria", () => {
  it("start about three weeks out for new Victorian systems, so there's time for approval", () => {
    expect(installLeadDays({ state: "VIC", expandingExistingSolar: false })).toBe(SOLAR_VIC_LEAD_DAYS);
    expect(installLeadDays({ state: "vic", expandingExistingSolar: true })).toBe(LEAD_TIME_DAYS);
    expect(installLeadDays({ state: "NSW", expandingExistingSolar: false })).toBe(LEAD_TIME_DAYS);
    const from = new Date(2026, 9, 1);
    const days = buildAvailability("ins_primero", from, 56, SOLAR_VIC_LEAD_DAYS);
    expect(days[0].date >= toISODate(addDays(from, SOLAR_VIC_LEAD_DAYS))).toBe(true);
  });
});

describe("Revo", () => {
  it("narrates each step and backs up the customer's choices", () => {
    expect(revoLine({ step: "profile" })).toContain("latest electricity bill");
    expect(revoLine({ step: "profile", dailyKwh: 14.7 })).toContain("about 14.7 kWh a day");
    expect(revoLine({ step: "profile", dailyKwh: 14.7, wantsBattery: true })).toContain("great call");
    expect(revoLine({ step: "system", tier: "essential" })).toContain("Essential");
    expect(revoLine({ step: "system", tier: "recommended", batteryKwh: 16 })).toContain("16 kWh battery");
    expect(revoLine({ step: "system", tier: "independence" })).toContain("EV charger");
    expect(revoLine({ step: "extras", backupAdded: true })).toContain("Blackout Backup");
    expect(revoLine({ step: "installer", partner: "Primero Electric & Solar" })).toContain("Primero Electric & Solar");
    expect(revoLine({ step: "date", installDate: "Tuesday 14 October" })).toContain("Tuesday 14 October it is");
    expect(revoLine({ step: "reserve" })).toContain("no commitment");
    expect(revoLine({ step: "confirmed", firstName: "Michelle" })).toContain("Michelle");
  });

  it("never calls itself AI or promises what can't be known", () => {
    const steps = ["analysing", "profile", "system", "extras", "installer", "date", "reserve", "confirmed", "other"];
    for (const step of steps) {
      const line = revoLine({ step, dailyKwh: 12, batteryKwh: 8, tier: "recommended" });
      expect(line).not.toMatch(/\bAI\b|artificial|guarantee|exact|precise/i);
    }
  });

  it("opens Ask Revo about the screen the customer is on", () => {
    expect(revoContext("system")).toBe("recommendation");
    expect(revoContext("reserve")).toBe("checkout");
    expect(revoContext("anything")).toBe("home");
  });
});
