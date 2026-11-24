import { describe, expect, it } from "vitest";
import { DEFAULT_BRAND, cleanContent, contrastRatio, inksOf, renderEdm, styleOf, styleProblem, type EdmContent } from "./edm";

const sender = { name: "Sunrise Solar", abn: null, email: "hi@sunrise.example", phone: null, address: null };
const links = { click: (_i: number, url: string) => url, pixel: null, unsubscribe: "#", image: (id: string) => `/i/${id}` };
const email = (style?: unknown): EdmContent =>
  cleanContent({
    subject: "Hi",
    preview: "",
    style,
    blocks: [
      { id: "aaaa1", kind: "heading", text: "Big news" },
      { id: "aaaa2", kind: "text", text: "Hello there" },
    ],
  });
const html = (c: EdmContent) => renderEdm(c, DEFAULT_BRAND, sender, { firstName: "Sam", company: "X" }, links).html;

describe("an email's own colours", () => {
  it("keeps our colours, and no style on the email, until one is chosen", () => {
    const c = email();
    expect(c.style).toBeUndefined();
    expect(html(c)).toContain("background:#ffffff");
    expect(html(c)).toContain("color:#0b0b0c");
    expect(html(c)).toContain("color:#3c3d41");
  });

  it("draws the background and text colour chosen, for headings and words alike", () => {
    const c = email({ background: "#1E3A2E", text: "#FAF9F6" });
    expect(c.style).toEqual({ background: "#1e3a2e", text: "#faf9f6" });
    const out = html(c);
    expect(out).toContain("background:#1e3a2e");
    expect(out).not.toContain("color:#3c3d41");
    expect(out.match(/color:#faf9f6/g)?.length).toBeGreaterThanOrEqual(3);
  });

  it("drops anything that isn't a six-digit colour", () => {
    expect(email({ background: "red; display:none", text: "url(x)" }).style).toBeUndefined();
    expect(styleOf({ style: { background: "#abc", text: "#123456" } })).toEqual({ background: "#ffffff", text: "#123456" });
  });

  it("says when the words would be hard to read", () => {
    expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 0);
    expect(styleProblem({ background: "#ffffff", text: null })).toBeNull();
    expect(styleProblem({ background: "#1e3a2e", text: null })).not.toBeNull();
    expect(styleProblem({ background: "#1e3a2e", text: "#ffffff" })).toBeNull();
    expect(inksOf({ background: "#000000", text: "#eeeeee" })).toEqual({ heading: "#eeeeee", words: "#eeeeee" });
  });
});
