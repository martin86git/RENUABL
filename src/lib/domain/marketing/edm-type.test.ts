import { describe, expect, it } from "vitest";
import { DEFAULT_BRAND, cleanBlock, newBlock, renderEdm, type EdmBlock, type EdmContent } from "./edm";

const sender = { name: "Sunrise Solar", abn: "", email: "hello@example.com", phone: "", address: "1 Sample Street" };
const links = { click: (_i: number, url: string) => url, open: "", unsubscribe: "https://example.com/u", image: (id: string) => id };
const html = (blocks: EdmBlock[]) =>
  renderEdm(
    { subject: "s", preview: "p", blocks } as EdmContent,
    DEFAULT_BRAND,
    sender as never,
    { firstName: "Sam", company: null },
    links as never,
  ).html;

describe("a heading's and the words' font and size (27 Nov 2026, Martin)", () => {
  it("keeps only real choices, and neither while it is the usual", () => {
    const kept = cleanBlock({ ...newBlock("heading"), text: "Hi", font: "classic", textSize: "xl" });
    expect(kept).toMatchObject({ font: "classic", textSize: "xl" });
    const usual = cleanBlock({ ...newBlock("text"), text: "Hi", font: "modern", textSize: "medium" });
    expect(usual).not.toHaveProperty("font");
    expect(usual).not.toHaveProperty("textSize");
    const odd = cleanBlock({ ...newBlock("heading"), text: "Hi", font: "Comic Sans", textSize: "huge" });
    expect(odd).not.toHaveProperty("font");
    expect(odd).not.toHaveProperty("textSize");
    // Only on a heading or the words.
    expect(cleanBlock({ ...newBlock("button"), text: "Go", url: "https://example.com/", font: "classic" })).not.toHaveProperty("font");
  });

  it("draws them in the email, and draws the usual as it always was", () => {
    const out = html([{ ...newBlock("heading"), text: "Big", font: "classic", textSize: "xl" } as EdmBlock]);
    expect(out).toContain("font-family:Georgia");
    expect(out).toContain("font-size:36px");
    const words = html([{ ...newBlock("text"), text: "Small words", textSize: "small" } as EdmBlock]);
    expect(words).toContain("font-size:13px");
    const before = html([{ ...newBlock("heading"), text: "Usual" } as EdmBlock]);
    expect(before).toContain("font-family:Inter,Segoe UI,Helvetica,Arial,sans-serif;font-size:24px");
  });
});
