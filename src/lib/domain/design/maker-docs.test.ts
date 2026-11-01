import { describe, expect, it } from "vitest";
import { MAKER_SITES, SOL_MAKER_DOCS, sourcesLine } from "./maker-docs";
import { solSystem } from "./sol";

describe("the sites Sol may search", () => {
  it("are plain hostnames the web tools accept, each once, within their limit", () => {
    expect(MAKER_SITES.length).toBeGreaterThan(0);
    expect(MAKER_SITES.length).toBeLessThanOrEqual(64);
    expect(new Set(MAKER_SITES).size).toBe(MAKER_SITES.length);
    for (const s of MAKER_SITES) expect(s).toMatch(/^[a-z0-9-]+(\.[a-z0-9-]+)+$/);
  });
  it("cover the makers RENUABL prices with, and the official bodies", () => {
    for (const s of ["sungrowpower.com", "sigenergy.com", "jinkosolar.com", "clenergy.com.au", "cer.gov.au"])
      expect(MAKER_SITES).toContain(s);
  });
});

describe("Sol's rules for makers' documents", () => {
  it("checks the business's figures first, names the model and the document, and never guesses", () => {
    expect(SOL_MAKER_DOCS).toMatch(/datasheet_lookup/);
    expect(SOL_MAKER_DOCS).toMatch(/exact model/);
    expect(SOL_MAKER_DOCS).toMatch(/never fill a gap/);
  });
  it("is in his instructions", () => {
    const prompt = solSystem({ business: "Sunrise Solar", member: "Sam", costs: true, facts: "", prefs: [], now: new Date() });
    expect(prompt).toContain("Makers' documents:");
  });
});

describe("the sources under an answer", () => {
  it("lists each page once, https only, up to the most", () => {
    const line = sourcesLine([
      { url: "https://sungrowpower.com/a.pdf", title: "SH10RS datasheet" },
      { url: "https://sungrowpower.com/a.pdf", title: "again" },
      { url: "http://plain.example/x" },
      { url: "https://fronius.com/b" },
    ]);
    expect(line).toBe("Sources:\n- SH10RS datasheet: https://sungrowpower.com/a.pdf\n- https://fronius.com/b");
    expect(sourcesLine([])).toBe("");
  });
});
