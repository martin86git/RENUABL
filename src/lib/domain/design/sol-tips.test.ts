import { describe, expect, it } from "vitest";
import { asksToBookmark, cleanTipInput, isTip, libraryFor, type KnowledgeEntry } from "./sol-knowledge";

const entry = (o: Partial<KnowledgeEntry>): KnowledgeEntry => ({
  id: o.id ?? "k",
  topic: o.topic ?? "technical",
  question: o.question ?? "Q",
  answer: o.answer ?? "A",
  sources: o.sources ?? [],
  savedBy: "a@b.com",
  savedAt: o.savedAt ?? "2026-11-24T00:00:00Z",
  uses: o.uses ?? 0,
  usedAt: null,
});

describe("bookmarked tips", () => {
  it("knows when the member asks to keep something", () => {
    expect(asksToBookmark("Save this a bookmarked tech tip: Inverter to Gas meter clearance - 1500mm")).toBe(true);
    expect(asksToBookmark("bookmark that")).toBe(true);
    expect(asksToBookmark("remember this for next time")).toBe(true);
    expect(asksToBookmark("so is it 1000mm or 1500mm?")).toBe(false);
  });
  it("keeps a title and a tip, technical unless said, with no pages", () => {
    const r = cleanTipInput({ title: "  Inverter to gas meter clearance ", tip: "1500 mm in the direction the vent blows" });
    expect(r.ok && r.value).toEqual({
      topic: "technical",
      question: "Inverter to gas meter clearance",
      answer: "1500 mm in the direction the vent blows",
      sources: [],
    });
    expect(cleanTipInput({ title: "x", tip: "" }).ok).toBe(false);
    expect(cleanTipInput({ title: "Rexel Dandenong hours", tip: "7 to 4", topic: "wholesaler" }).ok && true).toBe(true);
  });
  it("tells a tip from a sourced answer, and puts technical ones first", () => {
    expect(isTip(entry({}))).toBe(true);
    expect(isTip(entry({ sources: [{ url: "https://x.gov.au", title: "x", from: "web" }] }))).toBe(false);
    const lib = libraryFor([entry({ id: "r", topic: "rebates", uses: 9 }), entry({ id: "t", topic: "technical" })]);
    expect(lib.map((e) => e.id)).toEqual(["t", "r"]);
  });
});
