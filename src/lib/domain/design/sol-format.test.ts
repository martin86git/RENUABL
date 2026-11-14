import { describe, expect, it } from "vitest";
import { LONG_PARAGRAPH, MAX_OPTIONS, answerFor, brokenUp, isYesNoQuestion, solBlocks, solPlain } from "./sol-format";
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

describe("answering Sol's questions", () => {
  it("knows a yes or no question", () => {
    expect(isYesNoQuestion("Want me to do that swap now?")).toBe(true);
    expect(isYesNoQuestion("Do you want me to open Settings, Product datasheets for you?")).toBe(true);
    expect(isYesNoQuestion("Shall I draft a reply to him?")).toBe(true);
  });

  it("isn't fooled by an open question or a choice", () => {
    expect(isYesNoQuestion("Which customer is the case for?")).toBe(false);
    expect(isYesNoQuestion("Do you want the 10 kW or the 13 kW design?")).toBe(false);
    expect(isYesNoQuestion("Want me to do that swap now")).toBe(false);
  });

  it("names the question in what goes to Sol", () => {
    expect(answerFor("Want me to do that swap now?", "Yes")).toBe('Answering your question "Want me to do that swap now?": Yes');
  });
});

describe("a question with options", () => {
  const asked = [
    "Here's how I could run it.",
    "",
    "? How should I approach prospects?",
    "- Consultative: ask questions, understand needs, then position the offer.",
    "- Direct and persuasive — lead with the value and handle objections.",
    "- Warm and concise: keep calls brief and focused on the next step.",
  ].join("\n");

  it("becomes one choice with each option's name and line", () => {
    const blocks = solBlocks(asked);
    expect(blocks.map((b) => b.kind)).toEqual(["para", "choose"]);
    const choice = blocks[1];
    if (choice.kind !== "choose") throw new Error("not a choice");
    expect(choice.text).toBe("How should I approach prospects?");
    expect(choice.options.map((o) => o.label)).toEqual(["Consultative", "Direct and persuasive", "Warm and concise"]);
    expect(choice.options[1].detail).toBe("lead with the value and handle objections.");
  });

  it("takes short names with no line, and bold names", () => {
    const blocks = solBlocks("? Which design?\n- **Fastest payback**\n- Best return");
    expect(blocks[0]).toEqual({
      kind: "choose",
      text: "Which design?",
      options: [
        { label: "Fastest payback", detail: "" },
        { label: "Best return", detail: "" },
      ],
    });
  });

  it("leaves a long list or long sentences as a list to read", () => {
    const many = ["? Which?", ...Array.from({ length: MAX_OPTIONS + 1 }, (_, i) => `- Option ${i + 1}`)].join("\n");
    expect(solBlocks(many).map((b) => b.kind)).toEqual(["ask", "list"]);
    const sentences =
      "? Anything else?\n- the inverter sits on the north wall beside the meter box today\n- the battery would go in the garage";
    expect(solBlocks(sentences).map((b) => b.kind)).toEqual(["ask", "list"]);
  });
});

describe("what in a line of Sol's is set apart", () => {
  it("finds figures, marked words, phone numbers and emails, and changes no words", async () => {
    const { solRuns } = await import("./sol-format");
    const line =
      "At least 600 mm from a window, **never** below it. Ring 1800 786 476 or service@example.com.au. A 13.5 kWh battery is $1,200 and 90% usable.";
    const runs = solRuns(line);
    expect(runs.map((r) => r.text).join("")).toBe(line.replace(/\*\*/g, ""));
    expect(runs.filter((r) => r.kind === "figure").map((r) => r.text)).toEqual(["600 mm", "13.5 kWh", "$1,200", "90%"]);
    expect(runs.find((r) => r.kind === "strong")?.text).toBe("never");
    expect(runs.find((r) => r.kind === "phone")).toMatchObject({ text: "1800 786 476", dial: "1800786476" });
    expect(runs.find((r) => r.kind === "email")?.text).toBe("service@example.com.au");
  });

  it("leaves plain words, years and bare numbers alone", async () => {
    const { solRuns, namedItem } = await import("./sol-format");
    expect(solRuns("Amendment 1 (2025) changed a few things in AS/NZS 5139:2019.")).toEqual([
      { kind: "text", text: "Amendment 1 (2025) changed a few things in AS/NZS 5139:2019." },
    ]);
    expect(namedItem("Voc: the open-circuit voltage")).toEqual({ name: "Voc", rest: "the open-circuit voltage" });
    expect(namedItem("It explains more clearly how windows are treated: see the figures")).toBeNull();
    expect(namedItem("A plain item")).toBeNull();
  });
});
