import { describe, expect, it } from "vitest";
import { completionFor, customerWordsOf, learnedPhrases, phrasesWith, shareable, teamPhrases } from "./sol-complete";

describe("completionFor", () => {
  const phrases = ["Who should I call first today?", "Which proposals have gone quiet?", "Draft a text to"];

  it("offers the rest of a phrase that starts the same way, in any case", () => {
    expect(completionFor("who sh", phrases)).toBe("ould I call first today?");
    expect(completionFor("WHICH pro", phrases)).toBe("posals have gone quiet?");
  });

  it("waits for three letters and stops at a finished sentence", () => {
    expect(completionFor("wh", phrases)).toBe("");
    expect(completionFor("Who should I call first today?", phrases)).toBe("");
    expect(completionFor("anything else.", phrases)).toBe("");
  });

  it("completes the last sentence only", () => {
    expect(completionFor("Thanks. Draft a t", phrases)).toBe("ext to");
  });

  it("offers nothing that doesn't match", () => {
    expect(completionFor("zebra", phrases)).toBe("");
  });

  it("has the built-in phrases to hand", () => {
    expect(completionFor("Which new lea")).toBe("ds has nobody contacted yet?");
  });
});

describe("learnedPhrases", () => {
  it("puts the most asked first, then the latest, and leaves out replies and long asks", () => {
    const got = learnedPhrases([
      { text: "How many batteries did we sell in October?", at: "2026-11-01" },
      { text: "Where is Jordan's install up to?", at: "2026-11-02" },
      { text: "where is jordan's install up to", at: "2026-11-20" },
      { text: 'Replying to your message: "x" then', at: "2026-11-21" },
      { text: "hi", at: "2026-11-21" },
      { text: "x".repeat(200), at: "2026-11-21" },
    ]);
    expect(got).toEqual(["where is jordan's install up to", "How many batteries did we sell in October?"]);
  });

  it("their own questions win over the usual ones", () => {
    const phrases = phrasesWith(["Which battery jobs are waiting on stock?"]);
    expect(completionFor("Which ba", phrases)).toBe("ttery jobs are waiting on stock?");
  });
});

describe("team suggestions", () => {
  const customers = customerWordsOf(["Jordan Smith", "Mia Nguyen"]);

  it("never shares a question naming a customer, a person, a number or an email", () => {
    expect(shareable("Where is jordan's install up to?", customers)).toBe(false);
    expect(shareable("Draft a text to Bec about Friday", customers)).toBe(false);
    expect(shareable("Call 0412345678 back", customers)).toBe(false);
    expect(shareable("Email bob@example.com the proposal", customers)).toBe(false);
    expect(shareable("What's at 12 Shearer Drive?", customers)).toBe(false);
  });

  it("shares plain questions, makers, months and solar terms", () => {
    expect(shareable("Which Sigenergy jobs are waiting on stock in December?", customers)).toBe(true);
    expect(shareable("How many STCs does a 10 kW system get?", customers)).toBe(true);
  });

  it("puts the questions most people asked first", () => {
    const got = teamPhrases(
      [
        { who: "a", text: "Which proposals went out this week?", at: "2026-11-20" },
        { who: "a", text: "Which proposals went out this week?", at: "2026-11-21" },
        { who: "b", text: "What installs are on next Tuesday?", at: "2026-11-19" },
        { who: "c", text: "What installs are on next Tuesday?", at: "2026-11-18" },
        { who: "c", text: "Where is Mia's battery?", at: "2026-11-22" },
      ],
      customers,
    );
    expect(got).toEqual(["What installs are on next Tuesday?", "Which proposals went out this week?"]);
  });

  it("comes after their own but before the usual ones", () => {
    const phrases = phrasesWith(["Who should I call about stock?"], ["Who should I call first this afternoon?"]);
    expect(completionFor("Who should I call f", phrases)).toBe("irst this afternoon?");
  });
});
