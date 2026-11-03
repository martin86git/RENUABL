import { describe, expect, it } from "vitest";
import { DEFAULT_ALERT, alertMatches, alertWords, cleanAlert, closingSoonEmail, newListingEmail, watchWords } from "./market-alerts";

describe("job alerts", () => {
  it("keeps only the distances offered", () => {
    expect(cleanAlert({ on: true, withinKm: 25, battery: true })).toEqual({ on: true, withinKm: 25, battery: true });
    expect(cleanAlert({ on: true, withinKm: null })).toEqual({ on: true, withinKm: null, battery: false });
    expect(cleanAlert({ on: "yes", withinKm: 37 })).toEqual({ ...DEFAULT_ALERT });
    expect(cleanAlert(null)).toEqual(DEFAULT_ALERT);
  });

  it("matches a job within the distance, and a battery job when only those are asked for", () => {
    const on = { on: true, withinKm: 50, battery: false } as const;
    expect(alertMatches(on, { batteryKwh: null }, 30)).toBe(true);
    expect(alertMatches(on, { batteryKwh: null }, 60)).toBe(false);
    expect(alertMatches({ ...on, battery: true }, { batteryKwh: null }, 10)).toBe(false);
    expect(alertMatches({ ...on, battery: true }, { batteryKwh: 16 }, 10)).toBe(true);
    expect(alertMatches({ ...on, on: false }, { batteryKwh: 16 }, 10)).toBe(false);
  });

  it("lets a job of unknown distance through only an alert for anywhere", () => {
    expect(alertMatches({ on: true, withinKm: 100, battery: false }, { batteryKwh: null }, null)).toBe(false);
    expect(alertMatches({ on: true, withinKm: null, battery: false }, { batteryKwh: null }, null)).toBe(true);
  });

  it("says what it does in a line", () => {
    expect(alertWords({ on: true, withinKm: 25, battery: true })).toBe(
      "New jobs within 25 km of your base with a battery are emailed to you.",
    );
    expect(alertWords({ on: true, withinKm: null, battery: false })).toBe("New jobs anywhere are emailed to you.");
    expect(alertWords(DEFAULT_ALERT)).toMatch(/^Off/);
  });
});

describe("watching", () => {
  it("counts watchers without naming them", () => {
    expect(watchWords(0)).toBe("");
    expect(watchWords(3)).toBe("3 watching");
  });
});

describe("the emails", () => {
  it("say the suburb, the system and the way in, and nothing of the customer", () => {
    const e = newListingEmail({
      suburb: "Box Hill",
      system: "6.65 kW · 14 panels",
      km: 14,
      closes: "Closes in 3 days",
      link: "https://www.renuabl.com.au/design/marketplace/lst_1",
      settings: "https://www.renuabl.com.au/design/marketplace",
    });
    expect(e.subject).toBe("New job in Box Hill: 6.65 kW · 14 panels");
    expect(e.text).toContain("14 km from you");
    expect(e.text).toContain("turned on job alerts");
    expect(e.html).toContain('href="https://www.renuabl.com.au/design/marketplace/lst_1"');
    const c = closingSoonEmail({ suburb: "Box<Hill", system: "x", link: "https://a.test/l" });
    expect(c.html).toContain("Box&lt;Hill");
    expect(c.subject).toMatch(/^Closes tomorrow/);
  });
});
