import { describe, expect, it } from "vitest";
import { DESIGN_RULE, callNotesPrompt, callNotesText, cleanCallNotes, cleanHeard, transcriptOf, wordsIn } from "./call-notes";

describe("the call note-taker", () => {
  it("reads what was heard, marking the notes added on purpose", () => {
    const lines = cleanHeard([
      { at: "10:01", text: "so a ten kilowatt system" },
      { at: "10:02", text: "battery on the garage wall", note: true, design: true },
      { at: "10:03", text: "send the quote Thursday", note: true },
      { at: "10:04", text: "   " },
      "junk",
    ]);
    expect(lines).toHaveLength(4);
    expect(wordsIn(lines)).toBe(14);
    expect(transcriptOf(lines)).toBe("so a ten kilowatt system\n[Design note] battery on the garage wall\n[Note] send the quote Thursday");
  });

  it("asks for only what was said, and names the business and customer", () => {
    const p = callNotesPrompt("Sunny Co", "Casey", "hello");
    expect(p).toContain("Sunny Co");
    expect(p).toContain("Casey");
    expect(p).toContain("never invent a figure");
  });

  it("writes the conversation first, then the system", () => {
    const notes = cleanCallNotes({
      summary: "Wants solar and a battery.",
      conversation: ["Bills over $600 a quarter"],
      forEmail: ["Send the quote"],
      nextStep: "Quote by Thursday",
      toCheck: [],
      forDesign: ["Battery in the garage"],
      system: { solar: "10 kW", battery: "13.5 kWh", nonsense: "x" },
    });
    const text = callNotesText(notes);
    expect(text.indexOf("From the conversation")).toBeLessThan(text.indexOf(DESIGN_RULE));
    expect(text).toContain("- Solar: 10 kW");
    expect(text).toContain("Next step: Quote by Thursday");
    expect(text).not.toContain("nonsense");
  });
});
