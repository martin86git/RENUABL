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
  pickups: [{ supplier: "AWM Clayton", so: "OSW923342" }],
  items: [
    { part: "Panels", qty: 13, item: "Jinko 475 W panel", sku: "JKM475", supplier: "AWM Clayton" },
    { part: "Racking", qty: 8, item: "Rails, 4.8 m", sku: "RAIL", supplier: "AWM Clayton" },
    { part: "Racking", qty: 4, item: "Roof kits, tile", sku: "TILE20", supplier: null },
  ],
  details: [
    { key: "systemSize", label: "System size", value: "6.175 kW" },
    { key: "panel", label: "PV panel", value: "Jinko 475 W" },
    { key: "panelQty", label: "Panel qty", value: "13" },
    { key: "battery", label: "Battery", value: "SigenStor 8 kWh" },
    { key: "roofType", label: "Roof type", value: "Tile" },
  ],
  site: [{ label: "NMI", value: "63052732619" }],
  reference: "PO-ABC123",
  slip: "https://example.com/pickup/abc",
};

describe("an installation as a calendar event", () => {
  const e = installEvent(input);
  const section = (heading: string) => e.sections.find((s) => s.heading === heading)!;

  it("is titled as the business's bookings are", () => {
    expect(e.title).toBe("Solar + Battery: Sunny Co | 6.175kW Single storey Phil Willison");
    expect(installEvent({ ...input, batteryKwh: 0, storeys: null }).title).toBe("Solar: Sunny Co | 6.175kW Phil Willison");
  });

  it("says where to collect, against which SO number, and flags what has no supplier", () => {
    expect(section("Collect from").groups.map((g) => [g.title, g.note ?? null, g.lines[0]])).toEqual([
      ["AWM Clayton", "PO-ABC123 · SO OSW923342", "2 items: solar, roof and racking"],
      ["No supplier set", null, "1 to source: roof and racking"],
    ]);
  });

  it("is one list: each part of the system with its facts and the exact items to collect for it", () => {
    const system = section("System to be installed").groups;
    expect(system.map((g) => g.title)).toEqual(["Solar", "Battery", "Roof and racking"]);
    const solar = system[0];
    // The panel and how many are said by the item, so not again as facts.
    expect(solar.lines).toEqual(["System size: 6.175 kW"]);
    expect(solar.items).toEqual([{ text: "13 x Jinko 475 W panel (JKM475)", from: "AWM Clayton" }]);
    // With no battery items on the order, the deal's own battery line stands in.
    expect(system[1].lines).toEqual(["Battery: SigenStor 8 kWh"]);
    expect(system[2].items?.map((i) => i.from)).toEqual(["AWM Clayton", "No supplier set"]);
  });

  it("is never for the customer: no email, no one invited", () => {
    expect(e.description).not.toMatch(/@/);
    expect(e.ics).not.toMatch(/ATTENDEE|ORGANIZER/);
    expect(e.googleUrl).not.toMatch(/add=|%40/);
  });

  it("puts the whole job sheet in the Google link", () => {
    const url = new URL(e.googleUrl);
    expect(url.searchParams.get("dates")).toBe("20261019T080000/20261019T160000");
    expect(url.searchParams.get("details")).toContain("<b>COLLECT FROM</b>");
    expect(url.searchParams.get("details")).toContain("<b>AWM Clayton</b><br>PO-ABC123 · SO OSW923342");
    expect(url.searchParams.get("details")).toContain("13 x Jinko 475 W panel (JKM475) · AWM Clayton");
    expect(url.searchParams.get("details")).toContain("Phone: 0400 000 000");
    // The pickup slip, not the deal: the installer has no sign-in to it.
    expect(url.searchParams.get("details")).toContain("https://example.com/pickup/abc");
    expect(url.searchParams.get("details")).not.toContain("/design/deals/");
    expect(e.description).toContain("Pickup slip, to show at the counter: https://example.com/pickup/abc");
  });

  it("makes an .ics file in the market's time zone, with text escaped and lines folded", () => {
    expect(e.ics).toContain("DTSTART;TZID=Australia/Melbourne:20261019T080000");
    expect(e.ics).toContain("LOCATION:1/8 Sample St\\, Kilsyth VIC 3137");
    expect(e.ics.split("\r\n").every((l) => l.length <= 75)).toBe(true);
  });
});
