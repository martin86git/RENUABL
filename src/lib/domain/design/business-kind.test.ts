import { afterEach, describe, expect, it, vi } from "vitest";
import { BUSINESS_KINDS, apiAllowed, cleanKind, joinsFree, pageAllowed, settingsFor } from "./business-kind";
import { KIND_SECTIONS, designsRoofs, sectionAt } from "./sections";

describe("kinds of business", () => {
  it("reads anything unknown as a retailer, as every business made before kinds was", () => {
    expect(cleanKind("installer")).toBe("installer");
    expect(cleanKind("inspector")).toBe("inspector");
    expect(cleanKind("admin")).toBe("retailer");
    expect(cleanKind(undefined)).toBe("retailer");
  });

  it("lets installers and inspectors join free, and says so when they choose", () => {
    expect(joinsFree("retailer")).toBe(false);
    expect(joinsFree("installer")).toBe(true);
    expect(joinsFree("inspector")).toBe(true);
    expect(BUSINESS_KINDS.find((k) => k.kind === "installer")!.price).toMatch(/Free to join.*\$3/);
    expect(BUSINESS_KINDS.find((k) => k.kind === "inspector")!.price).toBe("Free to join.");
  });
});

describe("what each login holds", () => {
  it("gives a retailer everything", () => {
    expect(pageAllowed("retailer", "/design/deals/abc")).toBe(true);
    expect(apiAllowed("retailer", "/api/design/customers")).toBe(true);
    expect(settingsFor("retailer")).toBeNull();
  });

  it("gives an installer its jobs, the design tool, the Marketplace and connections, never the CRM", () => {
    for (const p of [
      "/design",
      "/design/jobs",
      "/design/roof",
      "/design/roof?job=x",
      "/design/marketplace/equipment",
      "/design/connections",
      "/design/settings/billing",
    ])
      expect(pageAllowed("installer", p.split("?")[0])).toBe(true);
    for (const p of [
      "/design/deals/abc",
      "/design/customers",
      "/design/procurement/orders",
      "/design/messages",
      "/design/settings/brand",
      "/design/inspections",
      "/design/marketplace/mine",
    ])
      expect(pageAllowed("installer", p)).toBe(false);
    expect(apiAllowed("installer", "/api/design/projects")).toBe(true);
    expect(apiAllowed("installer", "/api/design/billing")).toBe(true);
    expect(apiAllowed("installer", "/api/design/marketplace/lst_1/picture")).toBe(true);
    for (const a of ["customers", "jobs", "orders", "proposals", "sol", "inbox", "messages", "brand"])
      expect(apiAllowed("installer", `/api/design/${a}`)).toBe(false);
  });

  it("gives an inspector its inspections, connections and the standards library, and no design tool", () => {
    expect(pageAllowed("inspector", "/design/inspections")).toBe(true);
    expect(pageAllowed("inspector", "/design/settings/standards")).toBe(true);
    expect(pageAllowed("inspector", "/design/roof")).toBe(false);
    expect(pageAllowed("inspector", "/design/marketplace/equipment/new")).toBe(true);
    expect(pageAllowed("inspector", "/design/marketplace/bids")).toBe(false);
    expect(apiAllowed("inspector", "/api/design/trade/abc")).toBe(true);
    expect(apiAllowed("inspector", "/api/design/marketplace")).toBe(false);
    expect(apiAllowed("inspector", "/api/design/base")).toBe(true);
    expect(apiAllowed("inspector", "/api/design/standards/abc")).toBe(true);
    expect(apiAllowed("inspector", "/api/design/projects")).toBe(false);
    expect(apiAllowed("inspector", "/api/design")).toBe(false);
    expect(designsRoofs("inspector")).toBe(false);
    expect(designsRoofs("installer")).toBe(true);
  });

  it("shows each kind its own sections", () => {
    expect(KIND_SECTIONS.installer.map((s) => s.id)).toEqual(["today", "jobs", "marketplace", "connections"]);
    expect(KIND_SECTIONS.inspector.map((s) => s.id)).toEqual(["today", "inspections", "marketplace", "connections"]);
    expect(sectionAt("/design/jobs", "installer").id).toBe("jobs");
    expect(sectionAt("/design/settings/users", "inspector").id).toBe("today");
  });
});

describe("the Marketplace for each kind", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("is the launch page for everyone while it is closed", () => {
    for (const kind of ["retailer", "installer", "inspector"] as const) expect(pageAllowed(kind, "/design/marketplace")).toBe(true);
    expect(KIND_SECTIONS.inspector.find((s) => s.id === "marketplace")?.pages.map((p) => p.id)).toEqual(["launch"]);
  });

  it("once open: an installer bids and trades but lists nothing; an inspector trades", async () => {
    vi.stubEnv("NEXT_PUBLIC_MARKETPLACE_OPEN", "true");
    vi.resetModules();
    const kinds = await import("./business-kind");
    const { KIND_SECTIONS: open } = await import("./sections");
    const pages = (kind: "retailer" | "installer" | "inspector") => open[kind].find((s) => s.id === "marketplace")?.pages.map((p) => p.id);
    expect(pages("retailer")).toEqual(["listings", "my-listings", "my-bids", "equipment", "my-equipment"]);
    expect(pages("installer")).toEqual(["listings", "my-bids", "equipment", "my-equipment"]);
    expect(pages("inspector")).toEqual(["equipment", "my-equipment"]);
    expect(kinds.pageAllowed("inspector", "/design/marketplace")).toBe(false);
    expect(kinds.pageAllowed("installer", "/design/marketplace")).toBe(true);
  });
});
