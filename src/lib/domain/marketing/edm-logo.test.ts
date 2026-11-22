import { describe, expect, it } from "vitest";
import { DEFAULT_BRAND, LOGO_HEIGHT, cleanBrand, newBlock, renderEdm, type EdmContent } from "./edm";

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
    expect(r.html).toContain(`src="https://site.test/api/m/i/${logo}" alt="Sunrise Solar" height="${LOGO_HEIGHT}"`);
  });

  it("says the business's name in words without one", () => {
    const r = renderEdm(content, DEFAULT_BRAND, sender, { firstName: "Sam", company: null }, links);
    expect(r.html).not.toContain("/api/m/i/");
    expect(r.html).toContain(">Sunrise Solar</td>");
  });
});
