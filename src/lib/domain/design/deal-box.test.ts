import { describe, expect, it } from "vitest";
import { boxMove } from "./deal-box";

describe("what a line typed to Sol on a deal opens", () => {
  it("opens the designer when the line plainly asks to start the design", () => {
    for (const t of [
      "lets start the design",
      "Let's start the design",
      "Start the design",
      "start design",
      "open the designer",
      "design it",
      "Design the roof",
      "design",
      "ok start the roof design please",
      "Sol, start the design",
      "can you start the design",
      "start Roberto's design",
      "do the design for Roberto",
      "take me to the design",
    ])
      expect(boxMove(t, "Roberto"), t).toBe("design");
  });

  it("opens the proposal when asked for it", () => {
    for (const t of ["open the proposal", "Start the proposal", "let's do the proposal", "create a proposal for Roberto", "make the quote"])
      expect(boxMove(t, "Roberto"), t).toBe("proposal");
  });

  it("leaves anything with more to it for Sol", () => {
    for (const t of [
      "start the design with 10 kW",
      "design it with a battery",
      "why is there no design yet?",
      "what should the design be",
      "send the proposal",
      "email Roberto about the design",
      "start the design and then email him",
      "is the design done",
      "call him",
      "",
      "the customer wants to know when the design will be ready so please let him know it is coming soon",
    ])
      expect(boxMove(t, "Roberto"), t).toBeNull();
  });
});
