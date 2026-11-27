import { describe, expect, it } from "vitest";
import { cleanHqTab, isDemoOwner, isMadeUpOwner, leadKinds, leadWords, recentLeads } from "./hq";

describe("RENUABL admin", () => {
  it("opens on enquiries unless a known tab is asked for", () => {
    expect(cleanHqTab("tickets")).toBe("tickets");
    expect(cleanHqTab("nope")).toBe("enquiries");
    expect(cleanHqTab(undefined)).toBe("enquiries");
  });

  it("names each kind of enquiry, and any it doesn't know", () => {
    expect(leadWords("demo")).toBe("Demo account");
    expect(leadWords("demo-request")).toBe("Book a demo");
    expect(leadWords("enterprise")).toBe("Talk to sales");
    expect(leadWords("something")).toBe("Enquiry");
  });

  it("lists only the kinds that have someone, demos first", () => {
    expect(leadKinds([{ kind: "marketplace" }, { kind: "demo" }, { kind: "zz" }])).toEqual(["demo", "marketplace", "zz"]);
    expect(leadKinds([{ kind: "demo" }, { kind: "demo-request" }])).toEqual(["demo-request", "demo"]);
    expect(leadKinds([])).toEqual([]);
  });

  it("counts the enquiries of the last week", () => {
    const now = new Date("2026-11-27T02:00:00Z");
    const leads = [{ at: "2026-11-26T00:00:00Z" }, { at: "2026-11-21T00:00:00Z" }, { at: "2026-11-01T00:00:00Z" }];
    expect(recentLeads(leads, now)).toBe(2);
    expect(recentLeads(leads, now, 30)).toBe(3);
  });

  it("tells demos and samples from businesses that signed up", () => {
    expect(isDemoOwner("demo-ab12@demo.renuabl.example")).toBe(true);
    expect(isMadeUpOwner("demo-ab12@demo.renuabl.example")).toBe(true);
    expect(isMadeUpOwner("sample-retailer@renuabl-staff.example")).toBe(true);
    expect(isDemoOwner("sample-retailer@renuabl-staff.example")).toBe(false);
    expect(isMadeUpOwner("sam@sunrise.com.au")).toBe(false);
    expect(isMadeUpOwner(null)).toBe(false);
  });
});
