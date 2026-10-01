import { describe, expect, it } from "vitest";
import { revoContext, revoLine } from "./revo";
import {
  LEAD_TIME_DAYS,
  SOLAR_VIC_LEAD_DAYS,
  addDaysISO,
  buildAvailability,
  installLeadDays,
  isBookableInstallDate,
  installDateNote,
  isInstallDay,
} from "./scheduling";

describe("install dates and Solar Victoria", () => {
  it("start two weeks out where Solar Victoria may apply, a week otherwise", () => {
    expect(installLeadDays({ state: "VIC", expandingExistingSolar: false })).toBe(SOLAR_VIC_LEAD_DAYS);
    expect(installLeadDays({ state: "vic", expandingExistingSolar: true })).toBe(LEAD_TIME_DAYS);
    expect(installLeadDays({ state: "NSW", expandingExistingSolar: false })).toBe(LEAD_TIME_DAYS);
    const days = buildAvailability("ins_primero", "2026-10-01", 56, SOLAR_VIC_LEAD_DAYS);
    expect(days[0].date >= addDaysISO("2026-10-01", SOLAR_VIC_LEAD_DAYS)).toBe(true);
  });

  it("keeps the next 7 days free to arrange the job: on 1 October, the 8th is the first day", () => {
    const days = buildAvailability("ins_primero", "2026-10-01", 14).map((d) => d.date);
    expect(days[0]).toBe("2026-10-08");
    expect(isBookableInstallDate("2026-10-07", "2026-10-01")).toBe(false);
    expect(isBookableInstallDate("2026-10-08", "2026-10-01")).toBe(true);
  });

  it("never offers weekends or Victorian public holidays", () => {
    const days = buildAvailability("ins_primero", "2026-10-01", 120).map((d) => d.date);
    expect(days).not.toContain("2026-10-10"); // Saturday
    expect(days).not.toContain("2026-10-11"); // Sunday
    expect(days).not.toContain("2026-11-03"); // Melbourne Cup Day
    expect(days).not.toContain("2026-12-25"); // Christmas Day
    expect(days).not.toContain("2026-12-28"); // Boxing Day (additional day)
    expect(days).toContain("2026-10-12"); // an ordinary Monday
    expect(days.every(isInstallDay)).toBe(true);
    // Every weekday from the 8th is offered (no random gaps).
    expect(days.slice(0, 5)).toEqual(["2026-10-08", "2026-10-09", "2026-10-12", "2026-10-13", "2026-10-14"]);
  });

  it("offers nothing past the end of the holiday list (extend it each year)", () => {
    expect(isInstallDay("2028-01-04")).toBe(false);
    expect(LEAD_TIME_DAYS).toBe(7);
    expect(SOLAR_VIC_LEAD_DAYS).toBe(14);
    expect(installDateNote(true)).toBe("This date is subject to your rebate approval.");
    expect(installDateNote(false)).toMatch(/installation calendar capacity/);
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
