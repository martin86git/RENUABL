import { describe, expect, it } from "vitest";
import { DEFAULT_BRAND, cleanBlock, edmLinks, newBlock, renderEdm, type EdmContent } from "./edm";

const sender = { name: "Sunrise Solar", abn: null, email: "hi@sunrise.example", phone: null, address: null };
const links = {
  click: (i: number) => `https://site.test/api/m/c/tok?l=${i}`,
  pixel: null,
  unsubscribe: "https://site.test/m/u/abc",
  image: (id: string) => `https://site.test/api/m/i/${id}`,
};
const html = (content: EdmContent) => renderEdm(content, DEFAULT_BRAND, sender, { firstName: "Sam", company: null }, links);

describe("product blocks", () => {
  it("starts with two empty products, two across", () => {
    const b = newBlock("products");
    expect(b.products).toHaveLength(2);
    expect(b.columns).toBe(2);
  });

  it("cleans products: lengths, https links only, at most six", () => {
    const b = cleanBlock({
      kind: "products",
      columns: 3,
      products: [
        { name: "  Battery\nbundle ", price: "$9,990", url: "javascript:alert(1)", text: "x".repeat(500) },
        { name: "Panels", url: "mailto:a@b.co" },
        ...Array.from({ length: 8 }, () => ({ name: "More" })),
      ],
    })!;
    expect(b.columns).toBe(3);
    expect(b.products).toHaveLength(6);
    expect(b.products![0]).toMatchObject({ name: "Battery bundle", price: "$9,990", url: null });
    expect(b.products![0].text.length).toBeLessThanOrEqual(240);
    expect(b.products![1].url).toBeNull();
    expect(b.text).toBe("");
  });

  it("sends only named products, each link tracked in order", () => {
    const content: EdmContent = {
      subject: "s",
      preview: "",
      blocks: [
        cleanBlock({
          kind: "products",
          products: [
            { name: "Solar and battery", price: "From $9,990", text: "For {firstName}", url: "https://sunrise.example/battery" },
            { name: "" },
            { name: "EV charger", url: "https://sunrise.example/ev", label: "See it" },
          ],
        })!,
      ],
    };
    expect(edmLinks(content.blocks)).toEqual(["https://sunrise.example/battery", "https://sunrise.example/ev"]);
    const r = html(content);
    expect(r.html).toContain("Solar and battery");
    expect(r.html).toContain("From $9,990");
    expect(r.html).toContain("For Sam");
    expect(r.html).toContain("https://site.test/api/m/c/tok?l=0");
    expect(r.html).toContain(">Find out more</a>");
    expect(r.html).toContain("https://site.test/api/m/c/tok?l=1");
    expect(r.html).toContain(">See it</a>");
    expect(r.text).toContain("Solar and battery: From $9,990");
    expect(r.text).toContain("See it: https://site.test/api/m/c/tok?l=1");
  });

  it("renders nothing for a block with no named product", () => {
    const r = html({ subject: "s", preview: "", blocks: [newBlock("products")] });
    expect(r.html).not.toContain("Find out more");
  });
});
