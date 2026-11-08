import { describe, expect, it } from "vitest";
import { SOL_PLACES, cleanGoTo, isSolPath, placesForSol, solGoTo } from "./sol-goto";

describe("Sol opening a page", () => {
  it("knows the sections' pages, the extras and Settings, each once", () => {
    const keys = SOL_PLACES.map((p) => p.key);
    expect(new Set(keys).size).toBe(keys.length);
    expect(SOL_PLACES.find((p) => p.key === "orders")?.path).toBe("/design/procurement/orders");
    expect(SOL_PLACES.find((p) => p.key === "calendar")?.path).toBe("/design/installations");
    expect(SOL_PLACES.find((p) => p.key === "settings:price-lists")?.path).toBe("/design/settings/price-lists");
    expect(keys).not.toContain("settings:view-as");
    expect(placesForSol()).toContain("orders: Ordering station");
  });

  it("builds a place's address", () => {
    expect(solGoTo({ page: "Orders" })).toEqual({
      ok: true,
      goTo: { path: "/design/procurement/orders", label: "Ordering station" },
      jobId: null,
    });
    expect(solGoTo({ page: "home", label: "Today" })).toMatchObject({ ok: true, goTo: { path: "/design", label: "Today" } });
  });

  it("builds a deal's page, tab, design and proposal, with the deal to check", () => {
    expect(solGoTo({ page: "deal", deal_id: "abc_12", tab: "email", label: "Casey's deal" })).toEqual({
      ok: true,
      goTo: { path: "/design/deals/abc_12?tab=email", label: "Casey's deal" },
      jobId: "abc_12",
    });
    expect(solGoTo({ page: "deal", deal_id: "abc", tab: "nonsense" })).toMatchObject({ goTo: { path: "/design/deals/abc" } });
    expect(solGoTo({ page: "design", deal_id: "abc" })).toMatchObject({
      goTo: { path: "/design/roof?job=abc", design: true },
      jobId: "abc",
    });
    expect(solGoTo({ page: "design" })).toMatchObject({ goTo: { path: "/design/roof", design: true }, jobId: null });
    expect(solGoTo({ page: "proposal", deal_id: "abc" })).toMatchObject({ goTo: { path: "/design/deals/abc/proposal" } });
  });

  it("refuses what isn't a place, or a deal place without a deal", () => {
    expect(solGoTo({ page: "https://example.com" }).ok).toBe(false);
    expect(solGoTo({ page: "/design/../admin" }).ok).toBe(false);
    expect(solGoTo({ page: "deal" }).ok).toBe(false);
    expect(solGoTo({ page: "deal", deal_id: "../x" }).ok).toBe(false);
    expect(solGoTo(null).ok).toBe(false);
  });

  it("checks a kept page again", () => {
    expect(cleanGoTo({ path: "/design/deals/abc?tab=chat", label: "  Casey  " })).toEqual({
      path: "/design/deals/abc?tab=chat",
      label: "Casey",
    });
    expect(cleanGoTo({ path: "/design/roof?job=abc" })).toEqual({ path: "/design/roof?job=abc", label: "the page", design: true });
    for (const path of ["https://example.com", "//evil", "/design/deals/abc?tab=bad", "/design/roof?job=a&x=1", "/admin", "javascript:x"])
      expect(isSolPath(path)).toBe(false);
    expect(cleanGoTo({ path: "/design/deals/<deal>" })).toBeNull();
  });
});
