import { describe, expect, it } from "vitest";
import { LONG_PARAGRAPH, brokenUp, solBlocks, solPlain } from "./sol-format";
import { MORE_DETAIL } from "./sol-charts";

describe("Sol's answers laid out", () => {
  it("reads paragraphs, a list, the key point and a question", () => {
    const text = [
      "Under the program a battery gets STCs if all of these are true:",
      "",
      "- It's new and on the approved list.",
      "- It's installed by an accredited installer.",
      "",
      "! A certificate issued after 31 December gets fewer STCs.",
      "",
      "? Should I check which of Taylor's dates that lands on?",
    ].join("\n");
    expect(solBlocks(text)).toEqual([
      { kind: "para", text: "Under the program a battery gets STCs if all of these are true:" },
      { kind: "list", items: ["It's new and on the approved list.", "It's installed by an accredited installer."] },
      { kind: "key", text: "A certificate issued after 31 December gets fewer STCs." },
      { kind: "ask", text: "Should I check which of Taylor's dates that lands on?" },
    ]);
  });

  it("gives a list its own block even with no blank line before it", () => {
    expect(solBlocks("Three things:\n- one\n- two\nThen the rest.")).toEqual([
      { kind: "para", text: "Three things:" },
      { kind: "list", items: ["one", "two"] },
      { kind: "para", text: "Then the rest." },
    ]);
  });

  it("keeps one list across blank lines and reads other bullets and numbers", () => {
    expect(solBlocks("• one\n\n* two\n3. three")).toEqual([{ kind: "list", items: ["one", "two", "three"] }]);
  });

  it("highlights a lone question even unmarked, mid-answer", () => {
    const blocks = solBlocks("The price holds until Friday.\n\nDo you want me to draft the email?\n\nOtherwise I'll leave it.");
    expect(blocks.map((b) => b.kind)).toEqual(["para", "ask", "para"]);
  });

  it("keeps the routine offer of more detail quiet", () => {
    expect(solBlocks(`Done.\n\n${MORE_DETAIL}`).at(-1)).toEqual({ kind: "more", text: MORE_DETAIL });
  });

  it("breaks a long paragraph at its sentences", () => {
    const long = Array.from({ length: 8 }, (_, i) => `Sentence number ${i + 1} says something about 1.5 kW and more.`).join(" ");
    expect(long.length).toBeGreaterThan(LONG_PARAGRAPH);
    const pieces = brokenUp(long);
    expect(pieces.length).toBeGreaterThan(1);
    expect(pieces.join(" ")).toBe(long);
    expect(pieces.every((p) => p.endsWith("."))).toBe(true);
  });

  it("leaves short paragraphs and lined ones whole", () => {
    expect(brokenUp("Short one. Two.")).toEqual(["Short one. Two."]);
  });

  it("takes the marks off for copying", () => {
    expect(solPlain("! Key point\n? A question?\n- item")).toBe("Key point\nA question?\n- item");
  });
});
