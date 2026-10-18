import { describe, expect, it } from "vitest";
import { installEvent, type InstallEventInput } from "./install-event";

const input: InstallEventInput = {
  business: "Sunny Co",
  jobId: "job_abc",
  date: "2026-10-19",
  customer: { name: "Phil Willison", phone: "0400 000 000" },
  address: "1/8 Sample St, Kilsyth VIC 3137",
  kw: 6.175,
  batteryKwh: 16,
  storeys: "Single",
  installer: "Amped Electrical",
  pickups: [
    {
      supplier: "AWM Clayton",
      so: "OSW923342",
      groups: [
        { title: "Panels", items: [{ qty: 13, item: "Jinko 475 W panel", sku: "JKM475" }] },
        { title: "Racking", items: [{ qty: 8, item: "Rails, 4.8 m", sku: "RAIL" }] },
      ],
    },
    { supplier: "Other Wholesale", so: "", groups: [{ title: "Battery", items: [{ qty: 2, item: "8 kWh module", sku: "BAT8" }] }] },
  ],
  system: [
    {
      title: "Solar",
      lines: [
        { label: "System size", value: "6.175 kW" },
        { label: "PV panel", value: "13 x Jinko 475 W" },
      ],
    },
    { title: "EV charger", lines: [] },
    { title: "Roof", lines: [{ label: "Roof type", value: "Tile" }] },
  ],
  site: [{ label: "NMI", value: "63052732619" }],
  link: "https://example.com/design/deals/job_abc",
};

describe("an installation as a calendar event", () => {
  const e = installEvent(input);

  it("is titled as the business's bookings are", () => {
    expect(e.title).toBe("Solar + Battery: Sunny Co | 6.175kW Single storey Phil Willison");
    expect(installEvent({ ...input, batteryKwh: 0, storeys: null }).title).toBe("Solar: Sunny Co | 6.175kW Phil Willison");
  });

  it("says where to collect each part, against which SO number, broken down under headings", () => {
    const materials = e.sections.find((s) => s.heading === "Materials")!;
    expect(materials.groups.map((g) => [g.title, g.note ?? null])).toEqual([
      ["Collect from AWM Clayton", "SO OSW923342"],
      ["Panels", null],
      ["Racking", null],
      ["Collect from Other Wholesale", "SO number not entered yet"],
      ["Battery", null],
    ]);
    expect(e.description).toContain("13 x Jinko 475 W panel (JKM475)");
  });

  it("lists the system to be installed under its headings, leaving out empty ones", () => {
    const system = e.sections.find((s) => s.heading === "System to be installed")!;
    expect(system.groups.map((g) => g.title)).toEqual(["Solar", "Roof"]);
  });

  it("is never for the customer: no email, no one invited", () => {
    expect(e.description).not.toMatch(/@/);
    expect(e.ics).not.toMatch(/ATTENDEE|ORGANIZER/);
    expect(e.googleUrl).not.toMatch(/add=|0400/);
  });

  it("puts the pickup in the Google link, with the way back to the full sheet", () => {
    const url = new URL(e.googleUrl);
    expect(url.searchParams.get("dates")).toBe("20261019T080000/20261019T160000");
    expect(url.searchParams.get("details")).toContain("Collect from AWM Clayton · SO OSW923342");
    expect(url.searchParams.get("details")).toContain(input.link);
  });

  it("makes an .ics file in the market's time zone, with text escaped and lines folded", () => {
    expect(e.ics).toContain("DTSTART;TZID=Australia/Melbourne:20261019T080000");
    expect(e.ics).toContain("LOCATION:1/8 Sample St\\, Kilsyth VIC 3137");
    expect(e.ics.split("\r\n").every((l) => l.length <= 75)).toBe(true);
  });
});
