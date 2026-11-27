import { describe, expect, it } from "vitest";
import {
  DEFAULT_BRAND,
  LOGOS_MAX,
  LOGO_HEIGHT,
  LOGO_LARGE,
  SITE_LOGOS,
  SITE_LOGO_KEYS,
  cleanBrand,
  cleanLogos,
  darkGround,
  logoSrc,
  logoBox,
  newBlock,
  renderEdm,
  withLogo,
  withLogoSize,
  withoutLogo,
  type EdmBrand,
  type EdmContent,
} from "./edm";

const sender = { name: "Sunrise Solar", abn: null, email: "hi@sunrise.example", phone: null, address: null };
const links = {
  click: (_i: number, u: string) => u,
  pixel: null,
  unsubscribe: "#",
  image: (id: string) => `https://site.test/api/m/i/${id}`,
};
const content: EdmContent = { subject: "s", preview: "", blocks: [{ ...newBlock("heading"), text: "Hello" }] };
const logo = "mimg_0123456789abcdef01234567";

describe("the logo at the top of an email", () => {
  it("keeps only a marketing picture's id", () => {
    expect(cleanBrand({ logoId: logo }).logoId).toBe(logo);
    expect(cleanBrand({ logoId: "https://evil.test/x.png" }).logoId).toBeNull();
    expect(cleanBrand({}).logoId).toBeNull();
  });

  it("heads the email with the logo, named for a screen reader", () => {
    const r = renderEdm(content, { ...DEFAULT_BRAND, logoId: logo }, sender, { firstName: "Sam", company: null }, links);
    expect(r.html).toContain(`src="https://site.test/api/m/i/${logo}?glow=1" alt="Sunrise Solar" height="${LOGO_HEIGHT}"`);
  });

  it("says the business's name in words without one", () => {
    const r = renderEdm(content, DEFAULT_BRAND, sender, { firstName: "Sam", company: null }, links);
    expect(r.html).not.toContain("/api/m/i/");
    expect(r.html).toContain(">Sunrise Solar</td>");
  });
});
describe("the logos a business keeps to switch between", () => {
  const a = "mimg_" + "a".repeat(24);
  const b = "mimg_" + "b".repeat(24);
  const brand = (over: Partial<EdmBrand> = {}): EdmBrand => ({ ...DEFAULT_BRAND, ...over });

  it("keeps each logo once, the one in use always among them, and never more than the most", () => {
    expect(cleanBrand({ logoId: a }).logos).toEqual([{ id: a, large: false }]);
    expect(cleanBrand({ logoId: a, logos: [{ id: b, large: true, site: "tagline" }, { id: b }, { id: "nope" }, "x"] }).logos).toEqual([
      { id: a, large: false },
      { id: b, large: true, site: "tagline" },
    ]);
    expect(cleanBrand({ logos: [{ id: a, site: "made-up" }] }).logos).toEqual([{ id: a, large: false }]);
    const many = Array.from({ length: LOGOS_MAX + 3 }, (_, i) => ({ id: "mimg_" + String(i).repeat(24) }));
    const kept = cleanLogos(many, a);
    expect(kept).toHaveLength(LOGOS_MAX);
    expect(kept[0].id).toBe(a);
  });

  it("switches between kept logos without losing any, and forgets one when asked", () => {
    let now = withLogo(brand(), a);
    now = withLogo(now, b, { large: true, site: "tagline" });
    expect(now.logoId).toBe(b);
    expect(now.logos.map((l) => l.id)).toEqual([b, a]);
    now = withLogo(now, a);
    expect(now.logoId).toBe(a);
    expect(now.logos.map((l) => l.id)).toEqual([b, a]);
    expect(withoutLogo(now, b).logos.map((l) => l.id)).toEqual([a]);
    // Forgetting the one in use leaves the business's name in words.
    expect(withoutLogo(now, a)).toMatchObject({ logoId: null, logos: [{ id: b }] });
  });

  it("draws the one in use larger only when it is marked so", () => {
    const now = withLogo(withLogo(brand(), a), b, { large: true });
    expect(logoBox(now)).toEqual(LOGO_LARGE);
    expect(logoBox(withLogo(now, a))).toEqual({ height: LOGO_HEIGHT, maxWidth: 240 });
    expect(logoBox(withLogoSize(withLogo(now, a), true))).toEqual(LOGO_LARGE);
    // Only the one in use changes size.
    expect(withLogoSize(withLogo(now, a), true).logos.find((l) => l.id === b)?.large).toBe(true);
    const html = renderEdm(content, now, sender, { firstName: "Sam", company: null }, links).html;
    expect(html).toContain(`height="${LOGO_LARGE.height}"`);
    expect(html).toContain(`max-width:${LOGO_LARGE.maxWidth}px`);
  });

  it("names RENUABL's own logos as files of the site", () => {
    for (const k of SITE_LOGO_KEYS) expect(SITE_LOGOS[k].path).toMatch(/^\/brand\/renuabl-logo[a-z-]*\.png$/);
    expect(SITE_LOGOS.tagline.large).toBe(true);
  });
});

describe("a logo that reads when a phone's dark mode darkens the email", () => {
  it("asks for an uploaded logo with its glow on a light ground, and as it is on a dark one", () => {
    expect(darkGround("#ffffff")).toBe(false);
    expect(darkGround("#1f2023")).toBe(true);
    expect(logoSrc("https://site.test/api/m/i/x", "#ffffff")).toBe("https://site.test/api/m/i/x?glow=1");
    expect(logoSrc("https://site.test/api/m/i/x", "#1f2023")).toBe("https://site.test/api/m/i/x");
    const brand = { ...DEFAULT_BRAND, logoId: logo };
    const fields = { firstName: "Sam", company: null };
    expect(renderEdm(content, brand, sender, fields, links).html).toContain(`/api/m/i/${logo}?glow=1"`);
    const dark = { ...content, style: { background: "#1f2023", text: null } };
    expect(renderEdm(dark, brand, sender, fields, links).html).toContain(`/api/m/i/${logo}"`);
  });
});
