import { describe, expect, it } from "vitest";
import { DEFAULT_BRAND, blockInner, blockWidthOf, cleanBlock, newBlock, renderEdm, type EdmBlock, type EdmContent } from "./edm";

const sender = { name: "Sunrise Solar", abn: "", email: "hello@example.com", phone: "", address: "1 Sample Street" };
const links = { click: (_i: number, url: string) => url, open: "", unsubscribe: "https://example.com/u", image: (id: string) => id };
const html = (blocks: EdmBlock[]) =>
  renderEdm(
    { subject: "s", preview: "p", blocks } as EdmContent,
    DEFAULT_BRAND,
    sender as never,
    { firstName: "Sam", company: "Acme" },
    links as never,
  ).html;
const bar = (extra: Partial<EdmBlock> = {}): EdmBlock => ({
  ...newBlock("bar"),
  text: "Ready?",
  label: "Go",
  url: "https://example.com/",
  ...extra,
});

describe("how wide a block is drawn", () => {
  it("keeps a width only where it is not the usual one", () => {
    expect(cleanBlock({ kind: "bar", text: "Hi", url: "https://x.au", width: "column" })?.width).toBe("column");
    expect(cleanBlock({ kind: "bar", text: "Hi", url: "https://x.au", width: "full" })?.width).toBeUndefined();
    expect(cleanBlock({ kind: "image", width: "column" })?.width).toBeUndefined();
    expect(cleanBlock({ kind: "image", width: "narrow" })?.width).toBe("narrow");
    expect(cleanBlock({ kind: "heading", text: "A", width: "narrow" })?.width).toBeUndefined();
    expect(cleanBlock({ kind: "image", width: "huge" })?.width).toBeUndefined();
  });
  it("gives a top bar the card's edge and a picture the column, unless chosen", () => {
    expect(blockWidthOf({ kind: "bar" })).toBe("full");
    expect(blockWidthOf({ kind: "image" })).toBe("column");
    expect(blockInner({ kind: "image" })).toBe(616);
    expect(blockInner({ kind: "bar", width: "column" })).toBe(616);
  });
  it("draws a top bar in the column when chosen, to line up with the picture under it", () => {
    expect(html([bar()])).toContain("padding:8px 16px");
    expect(html([bar({ width: "column" })])).toContain("padding:8px 32px");
    const narrow = html([{ ...newBlock("image"), imageId: "a".repeat(32), width: "narrow" }]);
    expect(narrow).toContain("padding:12px 96px");
    expect(narrow).toContain("max-width:488px");
  });
});
