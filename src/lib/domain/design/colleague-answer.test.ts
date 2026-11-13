import { describe, expect, it } from "vitest";
import {
  CARDS_MAX,
  COLLEAGUE_REPLY,
  COLLEAGUE_REPLY_TOOL,
  SAY_MAX,
  cardInWords,
  chatMessages,
  cleanCards,
  cleanChatAnswer,
  cleanChatHistory,
  colleagueChatPrompt,
  shortSay,
} from "./colleague-chat";

const deal = {
  kind: "deal",
  title: "Michelle Example",
  deal_id: "job_12345678",
  stage: "Designed",
  rows: [
    { label: "Last call", value: "Today 9am, booked by the phone assistant" },
    { label: "", value: "dropped" },
  ],
  text: "Asked about **flat roof** installations.",
};

describe("its answer", () => {
  it("is the words for the chat and what sits beside them", () => {
    const got = cleanChatAnswer({
      say: "Michelle's at **Designed**.\nWe've called her twice.",
      cards: [deal, { kind: "figures", title: "Calls", items: [{ label: "calls to Michelle", value: "2" }] }],
    });
    expect(got?.text).toBe("Michelle's at Designed. We've called her twice.");
    expect(got?.cards).toEqual([
      {
        kind: "deal",
        title: "Michelle Example",
        jobId: "job_12345678",
        stage: "Designed",
        rows: [{ label: "Last call", value: "Today 9am, booked by the phone assistant" }],
        text: "Asked about flat roof installations.",
      },
      { kind: "figures", title: "Calls", items: [{ label: "calls to Michelle", value: "2" }] },
    ]);
  });
  it("is nothing when it said nothing", () => {
    expect(cleanChatAnswer({ say: " ", cards: [deal] })).toBeNull();
    expect(cleanChatAnswer("words")).toBeNull();
  });
  it("is cut to whole sentences when it runs on", () => {
    const long = `${"A short sentence here. ".repeat(40)}`;
    const said = shortSay(long);
    expect(said.length).toBeLessThanOrEqual(SAY_MAX);
    expect(said.endsWith(".")).toBe(true);
    expect(shortSay("x".repeat(SAY_MAX + 50)).endsWith("…")).toBe(true);
  });
});

describe("what sits beside the chat", () => {
  it("keeps only the kinds we draw, each with something in it", () => {
    expect(
      cleanCards([
        { kind: "table", title: "No such thing", text: "x" },
        { kind: "note", title: "Empty" },
        { kind: "deal", title: "No facts" },
        {
          kind: "timeline",
          title: "Calls",
          events: [
            { when: "12 Nov", what: "Moved to Designed" },
            { when: "", what: "lost" },
          ],
        },
        { kind: "bars", title: "One bar says nothing", bars: [{ label: "Lead", value: 3 }] },
        {
          kind: "bars",
          title: "By stage",
          bars: [
            { label: "Lead", value: 3 },
            { label: "Sold", value: -2 },
            { label: "Bad", value: "4" },
          ],
        },
        "nonsense",
      ]),
    ).toEqual([
      { kind: "timeline", title: "Calls", events: [{ when: "12 Nov", what: "Moved to Designed" }] },
      {
        kind: "bars",
        title: "By stage",
        bars: [
          { label: "Lead", value: 3 },
          { label: "Sold", value: 0 },
        ],
      },
    ]);
  });
  it("takes a deal's id only when it reads as one", () => {
    const [card] = cleanCards([{ ...deal, deal_id: "../../admin?x=1" }]);
    expect(card.kind === "deal" && card.jobId).toBeNull();
  });
  it("holds at most a few", () => {
    const many = Array.from({ length: 9 }, (_, i) => ({ kind: "note", title: `Note ${i}`, text: "Words." }));
    expect(cleanCards(many)).toHaveLength(CARDS_MAX);
  });
  it("is not a thing at all when it isn't a list", () => {
    expect(cleanCards({ kind: "note" })).toEqual([]);
  });
});

describe("the conversation with cards in it", () => {
  const cards = cleanCards([deal]);
  it("keeps an answer's cards, never a member's", () => {
    const kept = cleanChatHistory([
      { role: "you", text: "Where's Michelle at?", cards: [deal] },
      { role: "assistant", text: "Designed.", cards: [deal, { kind: "script", title: "x" }] },
    ]);
    expect(kept[0]).toEqual({ role: "you", text: "Where's Michelle at?" });
    expect(kept[1].cards).toEqual(cards);
  });
  it("goes back to Claude with what was shown, in words", () => {
    const sent = chatMessages(
      [
        { role: "you", text: "Where's Michelle at?" },
        { role: "assistant", text: "Designed.", cards },
      ],
      "And the call?",
    );
    expect(sent[1].content).toContain("Designed.");
    expect(sent[1].content).toContain("Shown beside the chat");
    expect(sent[1].content).toContain("deal id job_12345678");
    expect(sent[2]).toEqual({ role: "user", content: "And the call?" });
  });
  it("says a card in a line", () => {
    expect(cardInWords({ kind: "figures", title: "Calls", items: [{ label: "calls", value: "2" }] })).toBe("Calls: 2 calls");
  });
});

describe("how it is told to answer", () => {
  const prompt = colleagueChatPrompt({
    name: "Tim",
    business: "Sunrise Solar (example)",
    firstName: "Sam",
    facts: null,
    today: "2026-11-14",
  });
  it("answers with its tool, short, with the detail beside", () => {
    expect(prompt).toContain(COLLEAGUE_REPLY_TOOL);
    expect(prompt).toContain("one or two short sentences");
    expect(prompt).toContain("window beside the chat");
    expect(prompt).toContain("only where it is quicker to take in than a sentence");
  });
  it("has a tool that needs only the words", () => {
    expect(COLLEAGUE_REPLY.name).toBe(COLLEAGUE_REPLY_TOOL);
    expect(COLLEAGUE_REPLY.input_schema.required).toEqual(["say"]);
  });
});
