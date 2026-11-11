import { describe, expect, it } from "vitest";
import { marketplacePagesFor, pageAt, sectionAt, SECTIONS } from "./sections";

describe("the sections across the top", () => {
  it("lights the section and page an address belongs to, the closest match winning", () => {
    expect(pageAt("/design/installations/invoices")?.page.id).toBe("invoices");
    expect(pageAt("/design/procurement/orders/job_123")?.page.id).toBe("orders");
    expect(pageAt("/design/sales/proposals")).toMatchObject({ section: { id: "proposals" }, page: { id: "sent" } });
    expect(pageAt("/design/calls")?.section.id).toBe("proposals");
  });

  it("counts a deal's own page, and the pages folded into Jobs, as Jobs", () => {
    expect(pageAt("/design/deals/job_abc")).toMatchObject({ section: { id: "work" }, page: { id: "jobs" } });
    expect(pageAt("/design/installations/completed")).toMatchObject({ section: { id: "work" }, page: { id: "completed" } });
    expect(pageAt("/design/installations/grid")?.page.id).toBe("grid");
    expect(pageAt("/design/installations")?.page.id).toBe("jobs");
    expect(pageAt("/design/procurement/scheduler")?.section.id).toBe("work");
    expect(pageAt("/design/customers/c_1")?.section.id).toBe("customers");
  });

  it("falls back to Today for pages in no section, and lights Today only on the overview itself", () => {
    expect(sectionAt("/design/messages").id).toBe("today");
    expect(sectionAt("/design/roof").id).toBe("today");
    expect(pageAt("/design")?.page.id).toBe("home");
    expect(pageAt("/design/settings")).toBeNull();
  });

  it("gives every page a unique id", () => {
    const ids = SECTIONS.flatMap((s) => s.pages.map((p) => p.id));
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("the Marketplace's menu for each kind", () => {
  it("is all of it for a retailer, bidding and trading for an installer, trading for an inspector", () => {
    const ids = (k: Parameters<typeof marketplacePagesFor>[0]) => marketplacePagesFor(k).map((p) => p.id);
    expect(ids("retailer")).toEqual(["listings", "my-listings", "my-bids", "equipment", "my-equipment", "watching", "messages"]);
    expect(ids("installer")).toEqual(["listings", "equipment", "watching", "messages"]);
    expect(ids("inspector")).toEqual(["equipment", "my-equipment", "watching", "messages"]);
  });
});
