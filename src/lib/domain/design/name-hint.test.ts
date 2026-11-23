import { describe, expect, it } from "vitest";
import { cleanRing } from "./coaching";
import { nameAt, nameHints, withName } from "./name-hint";

const people = [
  { id: "1", name: "Martin Smith" },
  { id: "2", name: "Mary Jones" },
  { id: "3", name: "Tom Martinez" },
  { id: "4", name: "Priya Sample" },
];

describe("names offered as they are typed", () => {
  it("reads a capitalised word, or any word after call, ring or customer", () => {
    expect(nameAt("Call M", 6)).toEqual({ start: 5, typed: "M" });
    expect(nameAt("ring ma", 7)).toEqual({ start: 5, typed: "ma" });
    expect(nameAt("customer pr", 11)).toEqual({ start: 9, typed: "pr" });
    expect(nameAt("tell them about the roof", 24)).toBeNull();
    expect(nameAt("Call M ", 7)).toBeNull();
    expect(nameAt("Can", 3)).toBeNull();
  });
  it("takes two words of one name together", () => {
    expect(nameAt("Call Martin S", 13)).toEqual({ start: 5, typed: "Martin S" });
  });
  it("finds customers by any word of their name, or the whole name for two words", () => {
    expect(nameHints(people, "m").map((p) => p.id)).toEqual(["1", "2", "3"]);
    // First names first: Martinez's surname after them.
    expect(nameHints([{ id: "a", name: "Dan Mills" }, ...people], "m").map((p) => p.id)).toEqual(["1", "2", "a", "3"]);
    expect(nameHints(people, "Martin S").map((p) => p.id)).toEqual(["1"]);
    expect(nameHints(people, "zz")).toEqual([]);
  });
  it("puts the picked name in place of what was typed", () => {
    expect(withName("Call Mar and ask", { start: 5, typed: "Mar" }, "Martin Smith")).toEqual({
      text: "Call Martin Smith and ask",
      caret: 18,
    });
  });
  it("reads a call asked for in the chat", () => {
    expect(cleanRing({ customer: " Martin ", about: "ask about the\nproposal" })).toEqual({
      customer: "Martin",
      about: "ask about the proposal",
    });
    expect(cleanRing({ customer: "", about: "x" })).toBeNull();
  });
});
