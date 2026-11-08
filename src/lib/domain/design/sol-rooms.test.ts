import { describe, expect, it } from "vitest";
import { cleanSolInput, cleanTurns, type SolTurn } from "./sol";
import { cleanNewCase, cleanRoom, historyFor } from "./sol-rooms";

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
