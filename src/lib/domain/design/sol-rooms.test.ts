import { describe, expect, it } from "vitest";
import { cleanSolInput, cleanTurns, type SolTurn, dropExchange, withoutLastExchange } from "./sol";
import { cleanNewCase, cleanRoom, historyFor, panelTurns } from "./sol-rooms";

const at = (n: number) => new Date(Date.UTC(2026, 10, 8, 1, n)).toISOString();

describe("Sol's rooms", () => {
  const turns: SolTurn[] = [
    { role: "you", text: "Swap the Jinko datasheet", at: at(1) },
    { role: "sol", text: "Done, marked to check.", at: at(2) },
    { role: "you", text: "Let's create a new service case", at: at(3), room: "service" },
    { role: "sol", text: "The card's below.", at: at(4), room: "service" },
  ];
  it("gives a screen only its own conversation, and the side panel every turn", () => {
    expect(historyFor(turns, "service").map((t) => t.text)).toEqual(["Let's create a new service case", "The card's below."]);
    expect(historyFor(turns)).toHaveLength(4);
  });
  it("takes only a room it knows", () => {
    expect(cleanRoom("service")).toBe("service");
    expect(cleanRoom("deals")).toBeUndefined();
    expect(cleanSolInput({ text: "hi", room: "service" })?.room).toBe("service");
    expect(cleanSolInput({ text: "hi", room: "elsewhere" })?.room).toBeUndefined();
  });
  it("keeps a turn's room and Sol's new-case card when the conversation is kept", () => {
    const kept = cleanTurns([
      ...turns,
      { role: "sol", text: "Pick the deal below.", at: at(5), room: "service", newCase: { query: "Chloe", issue: "Earth fault" } },
      { role: "you", text: "x", at: at(6), newCase: { query: "not on a question" } },
    ]);
    expect(kept[2].room).toBe("service");
    expect(kept[4].newCase).toEqual({ query: "Chloe", issue: "Earth fault" });
    expect(kept[5].newCase).toBeUndefined();
  });
  it("cuts the card's words to one line and length", () => {
    expect(cleanNewCase({ query: "Chloe\nFraser", issue: 7 })).toEqual({ query: "Chloe Fraser", issue: "" });
    expect(cleanNewCase("nonsense")).toBeUndefined();
    expect(cleanNewCase({ query: "x".repeat(300) })?.query).toHaveLength(120);
  });
});

describe("Today's chat and the side panel are two conversations", () => {
  const at = (n: number) => `2026-11-24T01:0${n}:00.000Z`;
  const turns: SolTurn[] = [
    { role: "you", text: "Snapshot of the business", at: at(1), room: "today" },
    { role: "sol", text: "One deal sold.", at: at(2), room: "today", credits: 1 },
    { role: "you", text: "How do three phases net off?", at: at(3) },
    { role: "sol", text: "The meter adds them.", at: at(4), credits: 1 },
    { role: "you", text: "And the pipeline?", at: at(5), room: "today" },
    { role: "sol", text: "Thin at the front.", at: at(6), room: "today", credits: 1 },
  ];
  it("keeps Today's turns out of the panel, and the panel's out of Today", () => {
    expect(cleanRoom("today")).toBe("today");
    expect(panelTurns(turns).map((t) => t.at)).toEqual([at(3), at(4)]);
    expect(historyFor(turns).map((t) => t.at)).toEqual([at(3), at(4)]);
    expect(historyFor(turns, "today").map((t) => t.at)).toEqual([at(1), at(2), at(5), at(6)]);
  });
  it("tries another answer in the conversation it was pressed in, leaving the other alone", () => {
    const panel = withoutLastExchange(historyFor(turns));
    expect(panel?.question.at).toBe(at(3));
    // The panel's question asked again: Today's later exchange stays.
    expect(dropExchange(turns, at(3)).map((t) => t.at)).toEqual([at(1), at(2), at(5), at(6)]);
    // Today's first question asked again: its own later turns go, the panel's stay.
    expect(dropExchange(turns, at(1)).map((t) => t.at)).toEqual([at(3), at(4)]);
  });
});
