import { describe, expect, it } from "vitest";
import { installEvent, type InstallEventInput } from "./install-event";

const input: InstallEventInput = {
  business: "Sunny Co",
  jobId: "job_abc",
  date: "2026-10-19",
  customer: { name: "Phil Willison", email: "phil@example.com", phone: "0400 000 000" },
  address: "1/8 Sample St, Kilsyth VIC 3137",
  kw: 6.175,
  batteryKwh: 16,
  storeys: "Single storey",
  installer: "Amped Electrical",
  system: [
    { label: "System size", value: "6.175 kW" },
    { label: "PV panel", value: "13 x Jinko 475 W" },
    { label: "Roof type", value: "Tile" },
  ],
  materials: [{ qty: 13, item: "Jinko 475 W panel", sku: "JKM475" }],
  site: [{ label: "NMI", value: "63052732619" }],
  link: "https://example.com/design/deals/job_abc",
};

describe("an installation as a calendar event", () => {
  const e = installEvent(input);

  it("is titled as the business's bookings are", () => {
    expect(e.title).toBe("Solar + Battery: Sunny Co | 6.175kW Single storey Phil Willison");
    expect(installEvent({ ...input, batteryKwh: 0, storeys: null }).title).toBe("Solar: Sunny Co | 6.175kW Phil Willison");
    expect(installEvent({ ...input, storeys: "Double" }).title).toBe("Solar + Battery: Sunny Co | 6.175kW Double storey Phil Willison");
  });

  it("carries the job sheet: materials, customer, system and site", () => {
    expect(e.sections.map((s) => s.heading)).toEqual(["Materials", "Customer", "System", "Site"]);
    expect(e.description).toContain("13 x Jinko 475 W panel (JKM475)");
    expect(e.description).toContain("Phone: 0400 000 000");
  });

  it("keeps the customer's phone and email out of the Google link", () => {
    const url = new URL(e.googleUrl);
    expect(url.hostname).toBe("calendar.google.com");
    expect(url.searchParams.get("dates")).toBe("20261019T080000/20261019T160000");
    expect(url.searchParams.get("ctz")).toBe("Australia/Melbourne");
    expect(e.googleUrl).not.toContain("phil%40example.com");
    expect(e.googleUrl).not.toContain("0400");
    expect(url.searchParams.get("details")).toContain(input.link);
  });

  it("makes an .ics file in the market's time zone, with text escaped", () => {
    expect(e.ics).toContain("DTSTART;TZID=Australia/Melbourne:20261019T080000");
    expect(e.ics).toContain("SUMMARY:Solar + Battery: Sunny Co | 6.175kW Single storey Phil Willison");
    expect(e.ics).toContain("LOCATION:1/8 Sample St\\, Kilsyth VIC 3137");
    expect(e.ics.split("\r\n").every((l) => l.length <= 75)).toBe(true);
  });
});
