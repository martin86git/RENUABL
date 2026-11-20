import { describe, expect, it } from "vitest";
import {
  cleanBlock,
  cleanBrand,
  cleanContent,
  contentProblem,
  edmLinks,
  filledTiles,
  newBlock,
  renderEdm,
  type EdmBlock,
  type EdmSender,
} from "./edm";
import { EDM_LAYOUTS, cleanSections, isEdmLayout, layoutContent, sectionsAsk } from "./edm-sections";
import { edmSolPrompt } from "./edm-sol";

const IMG = (n: number) => `mimg_${String(n).padStart(24, "0")}`;
const sender: EdmSender = { name: "Sunrise Solar", abn: null, email: "hi@sunrise.example", phone: null, address: null };
const links = {
  click: (i: number) => `https://site.test/c?l=${i}`,
  pixel: null,
  unsubscribe: "https://site.test/u",
  image: (id: string) => `https://site.test/i/${id}`,
};

describe("picture tiles in an email", () => {
  const tiles: EdmBlock = {
    ...newBlock("tiles"),
    columns: 2,
    tiles: [
      { imageId: IMG(1), text: "Battery for {company}", url: "https://example.com.au/battery" },
      { imageId: null, text: "An empty spot", url: "https://example.com.au/empty" },
      { imageId: IMG(2), text: "", url: null },
      { imageId: IMG(3), text: "<b>Charger</b>", url: "https://example.com.au/charger" },
    ],
  };
  const content = {
    subject: "S",
    preview: "",
    blocks: [{ ...newBlock("heading"), text: "Hello" }, tiles, { ...newBlock("button"), text: "Go", url: "https://example.com.au/go" }],
  };

  it("keeps only real pictures, captions and https links, up to six", () => {
    const c = cleanBlock({
      kind: "tiles",
      columns: 7,
      tiles: [
        { imageId: "nope", text: "  A\ncaption ", url: "javascript:alert(1)" },
        ...Array.from({ length: 9 }, (_, i) => ({ imageId: IMG(i), text: "", url: "example.com.au" })),
      ],
    })!;
    expect(c.columns).toBe(2);
    expect(c.tiles).toHaveLength(6);
    expect(c.tiles![0]).toEqual({ imageId: null, text: "A caption", url: null });
    expect(c.tiles![1].url).toBe("https://example.com.au/");
    expect(cleanBlock({ kind: "heading", text: "x", tiles: [{}] })!.tiles).toBeUndefined();
  });

  it("sends only the tiles with a picture, and counts their links in order", () => {
    expect(filledTiles(tiles)).toHaveLength(3);
    expect(edmLinks(content.blocks)).toEqual([
      "https://example.com.au/battery",
      "https://example.com.au/charger",
      "https://example.com.au/go",
    ]);
    const r = renderEdm(content, cleanBrand({}), sender, { firstName: "Sam", company: "Acme" }, links);
    expect(r.html).toContain(`https://site.test/i/${IMG(1)}`);
    expect(r.html).toContain("Battery for Acme");
    expect(r.html).not.toContain("An empty spot");
    expect(r.html).toContain("&lt;b&gt;Charger&lt;/b&gt;");
    // Each link is the one its index names.
    expect(r.html.indexOf("c?l=0")).toBeLessThan(r.html.indexOf("c?l=1"));
    expect(r.html.indexOf("c?l=1")).toBeLessThan(r.html.indexOf("c?l=2"));
    expect(r.html).not.toContain("c?l=3");
    expect(r.html.match(/width="50%"/g)).toHaveLength(4);
  });

  it("leaves a block with no pictures out, and never stops an email being sent", () => {
    const empty = { ...content, blocks: [content.blocks[0], newBlock("tiles")] };
    expect(contentProblem(empty)).toBeNull();
    expect(renderEdm(empty, cleanBrand({}), sender, { firstName: null, company: null }, links).html).not.toContain("<img");
  });
});

describe("an email laid out in sections", () => {
  it("offers the simple layout and three, four or five sections", () => {
    expect(EDM_LAYOUTS).toEqual([1, 3, 4, 5]);
    expect(isEdmLayout(4)).toBe(true);
    expect(isEdmLayout(2)).toBe(false);
    expect(isEdmLayout("3")).toBe(false);
  });

  it("starts each section with a heading, words and a spot for pictures, and closes on one button", () => {
    for (const n of [3, 4, 5] as const) {
      const c = layoutContent(n);
      const kinds = c.blocks.map((b) => b.kind);
      expect(kinds.filter((k) => k === "heading")).toHaveLength(n);
      expect(kinds.filter((k) => k === "tiles")).toHaveLength(n);
      expect(kinds.filter((k) => k === "divider")).toHaveLength(n - 1);
      expect(kinds.at(-1)).toBe("button");
      expect(kinds.filter((k) => k === "button")).toHaveLength(1);
      expect(new Set(c.blocks.map((b) => b.id)).size).toBe(c.blocks.length);
      // It survives the server's cleaning whole.
      expect(cleanContent(c).blocks).toHaveLength(c.blocks.length);
    }
    expect(layoutContent(1).blocks.map((b) => b.kind)).toEqual(["heading", "text", "button"]);
  });

  it("puts Sol's words in their sections", () => {
    const written = {
      subject: "S",
      preview: "P",
      button: "Book a call",
      sections: [
        { heading: "One", text: "Hi {firstName},\n\nFirst." },
        { heading: "Two", text: "Second." },
      ],
    };
    const c = layoutContent(3, written);
    const headings = c.blocks.filter((b) => b.kind === "heading").map((b) => b.text);
    expect(headings).toEqual(["One", "Two", "Section 3"]);
    expect(c.blocks.find((b) => b.kind === "text")!.text).toBe("Hi {firstName},\n\nFirst.");
    expect(c.blocks.at(-1)!.text).toBe("Book a call");
    expect(c.subject).toBe("S");
    const simple = layoutContent(1, written);
    expect(simple.blocks.map((b) => b.text)).toEqual(["One", "Hi {firstName},\n\nFirst.", "Book a call"]);
  });

  it("tidies what Sol answers to the count asked for", () => {
    const got = cleanSections(
      {
        subject: '"A subject"',
        preview: "A\npreview",
        button: "Go {lastName}",
        sections: [
          { heading: "H1", text: "T1\r\n\n\n\nmore" },
          { heading: "", text: "" },
          { heading: "H2", text: "T2" },
          { heading: "H3", text: "T3" },
          7,
        ],
      },
      2,
    )!;
    expect(got).toEqual({
      subject: "A subject",
      preview: "A preview",
      button: "Go ",
      sections: [
        { heading: "H1", text: "T1\n\nmore" },
        { heading: "H2", text: "T2" },
      ],
    });
    expect(cleanSections({ sections: [] }, 3)).toBeNull();
    expect(cleanSections("nope", 3)).toBeNull();
  });

  it("asks Sol for the sections under his usual rules", () => {
    const p = edmSolPrompt("all", {
      business: "Sunrise Solar",
      brief: "Three new batteries",
      draft: { subject: "", preview: "", heading: "", text: "" },
      ask: sectionsAsk(4),
    });
    expect(p).toMatch(/exactly 4 sections/);
    expect(p).not.toMatch(/all four parts/);
    expect(p).toMatch(/Never write best, first, leading/);
    expect(p).toMatch(/never describe or refer to a picture/);
    expect(p).toContain("<brief>\nThree new batteries\n</brief>");
  });
});
