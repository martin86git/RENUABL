import { describe, expect, it } from "vitest";
import {
  DEFAULT_BRAND,
  HEADING_INK,
  buttonLook,
  buttonShapeOf,
  cleanBlock,
  cleanContent,
  newBlock,
  renderEdm,
  starterContent,
  type EdmBlock,
  type EdmContent,
} from "./edm";

const sender = { name: "Sunrise Solar", abn: "", email: "hello@example.com", phone: "", address: "1 Sample Street" };
const links = { click: (_i: number, url: string) => url, open: "", unsubscribe: "https://example.com/u", image: (id: string) => id };
const fields = { firstName: "Sam", company: "Acme" };
const html = (blocks: EdmBlock[]) =>
  renderEdm({ subject: "s", preview: "p", blocks } as EdmContent, DEFAULT_BRAND, sender as never, fields, links as never).html;

const button = (extra: Partial<EdmBlock> = {}): EdmBlock => ({ ...newBlock("button"), text: "Go", url: "https://example.com/", ...extra });
const bar = (extra: Partial<EdmBlock> = {}): EdmBlock => ({
  ...newBlock("bar"),
  text: "Ready?",
  label: "See pricing",
  url: "https://example.com/",
  ...extra,
});

describe("a button's look", () => {
  it("is as it was until something is chosen: a pill for a Button, rounded for a bar's, in the brand colour", () => {
    expect(buttonShapeOf(button())).toBe("pill");
    expect(buttonShapeOf(bar())).toBe("rounded");
    expect(buttonLook(button(), "#ff5a1f")).toEqual({
      radius: 999,
      fontSize: 15,
      padY: 12,
      padX: 24,
      background: "#ff5a1f",
      ink: "#ffffff",
      wide: false,
    });
    expect(buttonLook(bar(), "#ff5a1f")).toMatchObject({ radius: 10, fontSize: 14, padY: 10, padX: 18 });
    expect(html([button()])).toContain("font-size:15px;font-weight:600;text-decoration:none;padding:12px 24px;border-radius:999px");
    expect(html([bar()])).toContain("font-size:14px;font-weight:600;text-decoration:none;padding:10px 18px;border-radius:10px");
  });

  it("takes a shape, a size, a colour and full width, and draws them in the email", () => {
    const b = button({ shape: "square", size: "large", colour: "#1f6feb", wide: true });
    const out = html([b]);
    expect(out).toContain("display:block;text-align:center;background:#1f6feb;color:#ffffff");
    expect(out).toContain("font-size:17px");
    expect(out).toContain("padding:15px 32px;border-radius:0px");
    const top = html([bar({ shape: "pill", size: "small", colour: "#0b0b0c" })]);
    expect(top).toContain("background:#0b0b0c;color:#ffffff");
    expect(top).toContain("padding:8px 14px;border-radius:999px");
  });

  it("writes dark words on a colour too light for white", () => {
    expect(buttonLook(button({ colour: "#fff3ea" }), "#ff5a1f").ink).toBe(HEADING_INK);
    expect(buttonLook(button({ colour: "#0b0b0c" }), "#ff5a1f").ink).toBe("#ffffff");
  });

  it("keeps only real choices, leaves the usual ones out, and never makes a bar's button full width", () => {
    const kept = cleanBlock({ ...button(), shape: "rounded", size: "small", colour: "#1F6FEB", wide: true })!;
    expect(kept).toMatchObject({ shape: "rounded", size: "small", colour: "#1f6feb", wide: true });
    const usual = cleanBlock({ ...button(), shape: "pill", size: "medium", colour: "red", wide: false })!;
    for (const k of ["shape", "size", "colour", "wide"]) expect(usual).not.toHaveProperty(k);
    const top = cleanBlock({ ...bar(), shape: "rounded", wide: true, size: "huge" })!;
    for (const k of ["shape", "size", "wide"]) expect(top).not.toHaveProperty(k);
    expect(cleanBlock({ ...newBlock("heading"), shape: "square", colour: "#000000" })).not.toHaveProperty("shape");
  });

  it("leaves an email made before unchanged by the cleaner", () => {
    const c = starterContent();
    expect(cleanContent(c)).toEqual(c);
  });
});
