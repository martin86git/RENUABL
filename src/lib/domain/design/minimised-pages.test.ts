import { describe, expect, it } from "vitest";
import {
  MAX_MINIMISED,
  afterMinimise,
  chipTitle,
  cleanMinimised,
  groupMinimised,
  minimisedGroup,
  mayMinimise,
  withMinimised,
  withoutMinimised,
} from "./minimised-pages";

const page = (href: string, title = "T") => ({ href, title, scrollY: 0 });

describe("pages put aside", () => {
  it("keeps each page once, newest last, never past the most", () => {
    let list = withMinimised([], page("/design/deals/a"));
    list = withMinimised(list, page("/design/customers"));
    list = withMinimised(list, page("/design/deals/a?tab=email", "Again"));
    expect(list.map((p) => p.title)).toEqual(["T", "Again"]);
    for (let i = 0; i < 9; i++) list = withMinimised(list, page(`/design/deals/${i}`));
    expect(list).toHaveLength(MAX_MINIMISED);
    expect(withoutMinimised(list, "/design/deals/8?tab=x").some((p) => p.href === "/design/deals/8")).toBe(false);
  });

  it("puts aside pages inside the product but not Today or the designer", () => {
    expect(mayMinimise("/design/deals/x")).toBe(true);
    expect(mayMinimise("/design")).toBe(false);
    expect(mayMinimise("/design/roof")).toBe(false);
  });

  it("goes back to the page before, else Today", () => {
    expect(afterMinimise("/design/deals/a", "/design/customers")).toBe("/design/customers");
    expect(afterMinimise("/design/deals/a", "/design/deals/a?tab=x")).toBe("/design");
    expect(afterMinimise("/design/deals/a", null)).toBe("/design");
  });

  it("reads back only our own pages, and cuts a long title", () => {
    expect(cleanMinimised([page("https://evil.test"), page("//x"), { href: "/design/a", scrollY: -4 }, 3])).toEqual([
      { href: "/design/a", title: "Page", scrollY: 0 },
    ]);
    expect(chipTitle("A".repeat(40))).toHaveLength(28);
  });
});

describe("minimised pages under their headings", () => {
  it("groups by section, empty headings left out, newest first", () => {
    const p = (href: string) => ({ href, title: href, scrollY: 0 });
    const groups = groupMinimised([p("/design/deals/1"), p("/design/service"), p("/design/deals/2"), p("/design/updates")]);
    expect(groups.map((g) => g.label)).toEqual(["Deals", "Service", "Other"]);
    expect(groups[0].pages.map((x) => x.href)).toEqual(["/design/deals/2", "/design/deals/1"]);
    expect(minimisedGroup("/design/sales/pipelines?x=1")).toBe("Deals");
  });
});
