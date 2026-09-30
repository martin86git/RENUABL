import { describe, expect, it } from "vitest";
import { HOME_DESCRIPTION, HOME_TITLE, breadcrumbJsonLd, jsonLdHtml, siteJsonLd } from "./seo";

describe("SEO", () => {
  it("keeps the home title and description within what Google shows", () => {
    expect(HOME_TITLE.length).toBeLessThanOrEqual(60);
    expect(HOME_DESCRIPTION.length).toBeLessThanOrEqual(200);
    for (const t of [HOME_TITLE, HOME_DESCRIPTION]) expect(t).not.toMatch(/\b(best|first|leading|guaranteed?|AI|installer)\b/i);
  });

  it("describes RENUABL without ratings or reviews", () => {
    const json = JSON.stringify(siteJsonLd("https://www.renuabl.com.au"));
    expect(json).toContain('"@type":"Organization"');
    expect(json).not.toMatch(/aggregateRating|review/i);
  });

  it("builds breadcrumbs and escapes HTML", () => {
    const b = breadcrumbJsonLd("https://x.au", [
      { name: "Home", path: "" },
      { name: "Guide", path: "/learn/a" },
    ]);
    expect(b.itemListElement[1]).toMatchObject({ position: 2, item: "https://x.au/learn/a" });
    expect(jsonLdHtml({ a: "</script>" })).not.toContain("</script>");
  });
});
