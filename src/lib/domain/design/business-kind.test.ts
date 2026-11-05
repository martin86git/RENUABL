import { afterEach, describe, expect, it, vi } from "vitest";
import {
  BUSINESS_KINDS,
  apiAllowed,
  billingParts,
  billsFor,
  cleanKind,
  countByKind,
  joinsFree,
  pageAllowed,
  needsPlan,
  settingsFor,
} from "./business-kind";
import { KIND_SECTIONS, designsRoofs, pageAt, sectionAt } from "./sections";

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
    expect(apiAllowed("installer", "/api/design/draft")).toBe(true);
    expect(apiAllowed("installer", "/api/design/favourites")).toBe(true);
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
    // An installer's menu is My Jobs, the designer (the orange round) and the Marketplace; Connections is in the gear.
    expect(KIND_SECTIONS.installer.map((s) => s.label)).toEqual(["My Jobs", "Marketplace"]);
    expect(pageAt("/design", "installer")).toMatchObject({ section: { id: "jobs" }, page: { id: "jobs" } });
    expect(sectionAt("/design/jobs/shr_1", "installer").id).toBe("jobs");
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
    expect(pages("retailer")).toEqual(["listings", "my-listings", "my-bids", "equipment", "my-equipment", "watching", "messages"]);
    // An installer's toggles: Job listings, Buy & sell, Messages (My bids and My equipment are links inside them).
    expect(pages("installer")).toEqual(["listings", "equipment", "watching", "messages"]);
    expect(open.installer.find((s) => s.id === "marketplace")?.pages.map((p) => p.label)).toEqual([
      "Job listings",
      "Buy & sell",
      "Watching",
      "Messages",
    ]);
    expect(pages("inspector")).toEqual(["equipment", "my-equipment", "watching", "messages"]);
    expect(kinds.pageAllowed("inspector", "/design/marketplace")).toBe(false);
    expect(kinds.pageAllowed("installer", "/design/marketplace")).toBe(true);
  });
});

describe("what each kind is billed for", () => {
  it("gives a retailer its plan, Sol credits and design-job packs", () => {
    expect(billingParts("retailer")).toEqual(["plan", "sol", "packs"]);
  });

  it("bills an installer for design jobs only: no plan, no users, no Sol", () => {
    expect(billingParts("installer")).toEqual(["packs"]);
    expect(billsFor("installer", "plan")).toBe(false);
    expect(billsFor("installer", "sol")).toBe(false);
    expect(billsFor("installer", "packs")).toBe(true);
    expect(settingsFor("installer")).toContain("billing");
  });

  it("bills an inspector for nothing, and gives it no Billing", () => {
    expect(billingParts("inspector")).toEqual([]);
    expect(settingsFor("inspector")).not.toContain("billing");
    expect(apiAllowed("inspector", "/api/design/billing")).toBe(false);
  });
});

describe("staff's count of kinds", () => {
  it("counts every kind, none left out", () => {
    expect(countByKind([{ kind: "installer" }, { kind: "retailer" }, { kind: "installer" }])).toEqual({
      retailer: 1,
      installer: 2,
      inspector: 0,
    });
    expect(countByKind([])).toEqual({ retailer: 0, installer: 0, inspector: 0 });
  });
});

describe("choosing a plan at sign-up", () => {
  it("stops a retailer's owner with no live plan, and nobody else", () => {
    expect(needsPlan("retailer", "owner", null)).toBe(true);
    expect(needsPlan("retailer", "owner", "canceled")).toBe(true);
    expect(needsPlan("retailer", "owner", "active")).toBe(false);
    expect(needsPlan("retailer", "owner", "past_due")).toBe(false);
    expect(needsPlan("retailer", "member", null)).toBe(false);
    expect(needsPlan("installer", "owner", null)).toBe(false);
    expect(needsPlan("inspector", "owner", null)).toBe(false);
  });

  it("says the retailer's price as it is, not the first month alone", () => {
    expect(BUSINESS_KINDS.find((k) => k.kind === "retailer")!.price).toBe(
      "$99 a user a month. Your first month, $29 a user. Cancel any time.",
    );
  });
});
