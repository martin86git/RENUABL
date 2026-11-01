import { describe, expect, it } from "vitest";
import { REPLY_QUOTE_MAX, cleanVisuals, isTeamLineId, replyQuote } from "./team-chat";

describe("a reply's quote of the message it answers", () => {
  it("is the message's words on one line", () => {
    expect(replyQuote({ text: "Chloe's install\n\nis  Wednesday" })).toBe("Chloe's install is Wednesday");
  });
  it("is cut at a word, not past the limit", () => {
    const long = "battery clearances from exits and doorways ".repeat(10);
    const quote = replyQuote({ text: long });
    expect(quote.endsWith("…")).toBe(true);
    expect(quote.length).toBeLessThanOrEqual(REPLY_QUOTE_MAX + 1);
    expect(quote).not.toMatch(/\s…$/);
    expect(long.startsWith(quote.slice(0, -1))).toBe(true);
  });
  it("says what a message without words carried, never naming a deal", () => {
    const pic = { id: "tf_0123456789abcdef", name: "roof.png", type: "image/png", size: 10 };
    const pdf = { id: "tf_0123456789abcdee", name: "Quote.pdf", type: "application/pdf", size: 10 };
    expect(replyQuote({ text: "", files: [pic] })).toBe("A picture");
    expect(replyQuote({ text: "", files: [pdf] })).toBe("Quote.pdf");
    expect(replyQuote({ text: "", files: [pic, pic] })).toBe("2 pictures");
    expect(replyQuote({ text: "", files: [pic, pdf] })).toBe("2 files");
    expect(replyQuote({ text: " ", deals: [{ id: "job_1", name: "Chloe · Solar" }] })).toBe("A deal");
    expect(replyQuote({ text: "" })).toBe("A message");
  });
});

describe("the message a reply points at", () => {
  it("is a line id and nothing else", () => {
    expect(isTeamLineId("tl_0123456789abcdef0123")).toBe(true);
    for (const bad of ["", "tl_", "tl_XYZ", "job_0123456789abcdef", "tl_0123'; drop table x", 5, null, undefined])
      expect(isTeamLineId(bad)).toBe(false);
  });
});

describe("Sol's pictures in a channel", () => {
  it("are cleaned again when read: a drawing keeps only drawing, never script", () => {
    const svg =
      '<svg viewBox="0 0 720 420"><script>alert(1)</script><rect x="10" y="10" width="100" height="50" onclick="alert(1)"/><text x="20" y="40">600 mm</text></svg>';
    const { diagrams, charts } = cleanVisuals({ diagrams: [{ title: "Battery clearances", svg, caption: "Check on site" }] });
    expect(charts).toEqual([]);
    expect(diagrams).toHaveLength(1);
    expect(diagrams[0].svg).toContain("600 mm");
    expect(diagrams[0].svg).not.toMatch(/script|onclick/i);
  });
  it("are nothing when what is kept isn't pictures", () => {
    for (const bad of [null, undefined, "x", 5, { diagrams: "no" }, { charts: [{}] }])
      expect(cleanVisuals(bad)).toEqual({ charts: [], diagrams: [] });
  });
  it("read as a diagram or a chart in a reply's quote when there are no words", () => {
    expect(replyQuote({ text: "", diagrams: [{}] })).toBe("A diagram");
    expect(replyQuote({ text: "", charts: [{}] })).toBe("A chart");
  });
});
