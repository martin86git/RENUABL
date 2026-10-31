import { describe, expect, it } from "vitest";
import { pageAt, sectionAt, SECTIONS } from "./sections";

describe("the sections across the top", () => {
  it("lights the section and page an address belongs to, the closest match winning", () => {
    expect(pageAt("/design/installations/underway")?.page.id).toBe("works");
    expect(pageAt("/design/installations")?.page.id).toBe("upcoming");
    expect(pageAt("/design/procurement/scheduler")?.section.id).toBe("installation");
    expect(pageAt("/design/procurement/orders/job_123")?.page.id).toBe("orders");
  });

  it("counts a deal's own page as Deals", () => {
    expect(pageAt("/design/deals/job_abc")).toMatchObject({ section: { id: "crm" }, page: { id: "deals" } });
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
