import { describe, expect, it } from "vitest";
import { cleanBlock, cleanBrand, cleanSocials, edmLinks, networkOf, newBlock, renderEdm, type EdmContent, type EdmSender } from "./edm";

const sender: EdmSender = { name: "Sunrise Solar", abn: null, email: "hi@sunrise.example", phone: null, address: null };
const links = {
  click: (i: number) => `https://site.test/api/m/c/tok?l=${i}`,
  pixel: null,
  unsubscribe: "https://site.test/m/u/abc",
  image: (id: string) => `https://site.test/api/m/i/${id}`,
};

describe("spacer and social blocks", () => {
  it("keeps a spacer's height, medium unless small or large", () => {
    expect(cleanBlock({ kind: "spacer", space: "large" })?.space).toBe("large");
    expect(cleanBlock({ kind: "spacer", space: "huge" })?.space).toBe("medium");
    expect(cleanBlock({ kind: "spacer", text: "words" })?.text).toBe("");
    expect(newBlock("spacer").space).toBe("medium");
  });

  it("keeps known networks once each, https links only", () => {
    expect(
      cleanSocials([
        { network: "facebook", url: "https://facebook.com/sunrise" },
        { network: "facebook", url: "https://facebook.com/other" },
        { network: "myspace", url: "https://myspace.com/x" },
        { network: "instagram", url: "javascript:alert(1)" },
        { network: "website", url: "mailto:a@b.co" },
      ]),
    ).toEqual([
      { network: "facebook", url: "https://facebook.com/sunrise" },
      { network: "instagram", url: null },
      { network: "website", url: null },
    ]);
  });

  it("finds a link's network from its address", () => {
    expect(networkOf("https://www.instagram.com/sunrise")).toBe("instagram");
    expect(networkOf("https://au.linkedin.com/company/x")).toBe("linkedin");
    expect(networkOf("https://youtu.be/abc")).toBe("youtube");
    expect(networkOf("https://twitter.com/x")).toBe("x");
    expect(networkOf("https://notfacebook.com/x")).toBe("website");
  });

  it("draws the spacer, the social links as tracked words, and leaves out links not in yet", () => {
    const content: EdmContent = {
      subject: "Hi",
      preview: "",
      blocks: [
        { ...newBlock("button"), text: "Go", url: "https://renuabl.com.au" },
        { ...newBlock("spacer"), space: "large" },
        {
          ...newBlock("social"),
          socials: [
            { network: "facebook", url: "https://facebook.com/sunrise" },
            { network: "tiktok", url: null },
            { network: "instagram", url: "https://instagram.com/sunrise" },
          ],
        },
      ],
    };
    expect(edmLinks(content.blocks)).toEqual(["https://renuabl.com.au", "https://facebook.com/sunrise", "https://instagram.com/sunrise"]);
    const r = renderEdm(content, cleanBrand({}), sender, { firstName: "Sam", company: null }, links);
    expect(r.html).toContain("height:56px");
    expect(r.html).toContain("https://site.test/api/m/c/tok?l=1");
    expect(r.html).toContain("https://site.test/api/m/c/tok?l=2");
    expect(r.html).toContain(">Facebook</a>");
    expect(r.html).not.toContain("TikTok");
    expect(r.text).toContain("Instagram: https://instagram.com/sunrise");
  });

  it("sends nothing for a social block with no links", () => {
    const content: EdmContent = { subject: "Hi", preview: "", blocks: [{ ...newBlock("social"), socials: [{ network: "x", url: null }] }] };
    const r = renderEdm(content, cleanBrand({}), sender, { firstName: "Sam", company: null }, links);
    expect(r.html).not.toContain(">X</a>");
    expect(edmLinks(content.blocks)).toEqual([]);
  });
});
