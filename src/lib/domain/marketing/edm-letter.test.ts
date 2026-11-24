import { describe, expect, it } from "vitest";
import {
  DEFAULT_BRAND,
  EDM_INNER,
  EDM_WIDTH,
  cleanContent,
  edmLinks,
  fromNameOf,
  letterWarnings,
  lookOf,
  newBlock,
  renderEdm,
  type EdmContent,
} from "./edm";

const sender = { name: "Sunrise Solar", abn: null, email: "hi@sunrise.example", phone: null, address: null };
const links = {
  click: (i: number, u: string) => `https://site.test/c/${i}?u=${encodeURIComponent(u)}`,
  pixel: "https://site.test/o.gif",
  unsubscribe: "https://site.test/u",
  image: (id: string) => `https://site.test/api/m/i/${id}`,
};
const fields = { firstName: "Sam", company: null };
const pic = "mimg_0123456789abcdef01234567";
const base: EdmContent = {
  subject: "A quick one, {firstName}",
  preview: "",
  blocks: [
    { ...newBlock("heading"), text: "Hi {firstName}" },
    { ...newBlock("text"), text: "First line.\n\nSecond line." },
    { ...newBlock("button"), text: "Book a time", url: "https://sunrise.example/book" },
  ],
};

describe("the personal letter look", () => {
  it("is kept only when asked for, with its own sender name", () => {
    expect(cleanContent({ ...base, look: "letter", fromName: 'Martin <m@x>"' })).toMatchObject({ look: "letter", fromName: "Martin mx" });
    expect(cleanContent({ ...base, look: "fancy" }).look).toBeUndefined();
    expect(cleanContent(base).fromName).toBeUndefined();
    expect(lookOf({})).toBe("designed");
  });

  it("names the sender from the email, else Settings, else the business", () => {
    expect(fromNameOf({ fromName: "Martin" }, { fromName: "Team" }, sender)).toBe("Martin");
    expect(fromNameOf({}, { fromName: "Team" }, sender)).toBe("Team");
    expect(fromNameOf({}, { fromName: "" }, sender)).toBe("Sunrise Solar");
  });

  it("draws plain words on white: no card, logo or coloured button, the button a link, the footer and unsubscribe kept", () => {
    const html = renderEdm({ ...base, look: "letter" }, DEFAULT_BRAND, sender, fields, links).html;
    expect(html).toContain("<strong>Hi Sam</strong>");
    expect(html).toContain('<p style="margin:0 0 14px">First line.</p>');
    expect(html).toContain(`>Book a time</a>`);
    expect(html).not.toContain("border-radius:999px");
    expect(html).not.toContain("#f4f4f5");
    expect(html).not.toContain(DEFAULT_BRAND.colour);
    expect(html).toContain("https://site.test/c/0?u=");
    expect(html).toContain('href="https://site.test/u"');
    expect(html).toContain("Sunrise Solar");
    expect(html).toContain("https://site.test/o.gif");
  });

  it("counts its links in the same order as the designed email", () => {
    const c: EdmContent = {
      ...base,
      look: "letter",
      blocks: [...base.blocks, { ...newBlock("image"), imageId: pic, url: "https://x.example/2" }],
    };
    const html = renderEdm(c, DEFAULT_BRAND, sender, fields, links).html;
    edmLinks(c.blocks).forEach((u, i) => expect(html).toContain(`/c/${i}?u=${encodeURIComponent(u)}`));
  });

  it("sends the same plain text as the designed email", () => {
    expect(renderEdm({ ...base, look: "letter" }, DEFAULT_BRAND, sender, fields, links).text).toBe(
      renderEdm(base, DEFAULT_BRAND, sender, fields, links).text,
    );
  });

  it("says what would make it read as a newsletter", () => {
    expect(letterWarnings({ ...base, fromName: "Martin" })).toEqual([]);
    const busy: EdmContent = {
      ...base,
      blocks: [...base.blocks, { ...newBlock("image"), imageId: pic }, { ...newBlock("image"), imageId: pic }],
    };
    expect(letterWarnings(busy).join(" ")).toMatch(/2 pictures.*person's name/);
  });
});

describe("the email's width", () => {
  it("is 680 across with 616 inside the margins", () => {
    const html = renderEdm(
      { ...base, blocks: [...base.blocks, { ...newBlock("image"), imageId: pic }] },
      DEFAULT_BRAND,
      sender,
      fields,
      links,
    ).html;
    expect(html).toContain(`max-width:${EDM_WIDTH}px`);
    expect(html).toContain(`width="${EDM_INNER}"`);
    expect(EDM_WIDTH).toBe(680);
  });
});
