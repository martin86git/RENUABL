import { describe, expect, it } from "vitest";
import { DEFAULT_BRAND, DEFAULT_STYLE, cleanContent, contentProblem, edmLinks, inksOn, newBlock, renderEdm, type EdmContent } from "./edm";

const sender = { name: "Sunrise Solar", abn: null, email: "hi@sunrise.example", phone: null, address: null };
const links = {
  click: (i: number, u: string) => `https://t.test/${i}?u=${encodeURIComponent(u)}`,
  pixel: null,
  unsubscribe: "#",
  image: (id: string) => id,
};
const fields = { firstName: "Sam", company: null };

const bar = { ...newBlock("bar"), text: "Ready to choose a plan?", label: "Buy now", url: "https://sunrise.example/buy" };
const hero = (fill?: string) => [
  { ...newBlock("heading"), text: "Invoicing made simple", ...(fill ? { fill } : {}) },
  { ...newBlock("text"), text: "Create beautiful invoices.", ...(fill ? { fill } : {}) },
  { ...newBlock("button"), text: "Create an invoice", url: "https://sunrise.example/go", ...(fill ? { fill } : {}) },
];

describe("the top bar", () => {
  it("is kept with its line, button words and link, and needs all three", () => {
    const c = cleanContent({ subject: "s", preview: "", blocks: [bar, ...hero()] });
    expect(c.blocks[0]).toMatchObject({
      kind: "bar",
      text: "Ready to choose a plan?",
      label: "Buy now",
      url: "https://sunrise.example/buy",
    });
    expect(contentProblem(c)).toBeNull();
    expect(contentProblem({ ...c, blocks: [{ ...bar, url: null }, ...hero()] })).toMatch(/top bar/);
    expect(edmLinks(c.blocks)[0]).toBe("https://sunrise.example/buy");
  });

  it("leads the email above the logo when it comes first, its button a tracked link", () => {
    const html = renderEdm({ subject: "s", preview: "", blocks: [bar, ...hero()] }, DEFAULT_BRAND, sender, fields, links).html;
    expect(html.indexOf("Ready to choose a plan?")).toBeLessThan(html.indexOf(">Sunrise Solar"));
    expect(html).toContain(">Buy now</a>");
    expect(html).toContain("https://t.test/0?u=");
  });

  it("is a line with a link in a personal letter", () => {
    const html = renderEdm(
      { subject: "s", preview: "", look: "letter", blocks: [bar, ...hero()] },
      DEFAULT_BRAND,
      sender,
      fields,
      links,
    ).html;
    expect(html).toMatch(/Ready to choose a plan\? <a [^>]+>Buy now<\/a>/);
  });
});

describe("panel colours", () => {
  it("are kept only as six hex digits", () => {
    const c = cleanContent({
      subject: "s",
      preview: "",
      blocks: [
        { ...newBlock("heading"), fill: "#7B93E8" },
        { ...newBlock("text"), fill: "blue" },
      ],
    });
    expect(c.blocks[0].fill).toBe("#7b93e8");
    expect(c.blocks[1].fill).toBeUndefined();
  });

  it("join blocks in a row of one colour into one panel", () => {
    const c: EdmContent = { subject: "s", preview: "", blocks: hero("#7b93e8") };
    const html = renderEdm(c, DEFAULT_BRAND, sender, fields, links).html;
    expect(html.match(/background:#7b93e8;border-radius:16px/g)).toHaveLength(1);
    const two: EdmContent = { ...c, blocks: [...hero("#7b93e8"), { ...newBlock("spacer") }, ...hero("#7b93e8")] };
    expect(renderEdm(two, DEFAULT_BRAND, sender, fields, links).html.match(/background:#7b93e8;border-radius:16px/g)).toHaveLength(2);
  });

  it("draw the words dark on a light panel and light on a dark one", () => {
    expect(inksOn("#7b93e8", DEFAULT_STYLE).heading).toBe("#0b0b0c");
    expect(inksOn("#1f2023", DEFAULT_STYLE).heading).toBe("#ffffff");
    const html = renderEdm({ subject: "s", preview: "", blocks: hero("#1f2023") }, DEFAULT_BRAND, sender, fields, links).html;
    expect(html).toMatch(/color:#ffffff">Invoicing made simple/);
  });
});
