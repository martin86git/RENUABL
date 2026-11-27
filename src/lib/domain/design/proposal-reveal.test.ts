import { describe, expect, it } from "vitest";
import { REVEAL_MOST, REVEAL_QUESTIONS, cleanLike, cleanLikes, likeRecordLine, revealFor } from "./proposal-reveal";

describe("questions as the proposal is read", () => {
  it("asks once a part, and no more than a visit's share", () => {
    expect(revealFor("price", [])?.ask).toMatch(/price/);
    expect(revealFor("price", ["price"])).toBeNull();
    expect(revealFor("price", ["options", "hero", "figures"].slice(0, REVEAL_MOST))).toBeNull();
    expect(revealFor("terms", [])).toBeNull();
  });
  it("never states a figure, price or promise", () => {
    for (const q of REVEAL_QUESTIONS) {
      const words = [q.ask, ...q.replies].join(" ");
      expect(words).not.toMatch(/\$|\d|guarantee|free|best/i);
      expect(q.replies.length).toBeGreaterThanOrEqual(2);
    }
  });
});

describe("likes", () => {
  it("keeps real option keys only, once each", () => {
    expect(cleanLikes(["design-1", "design-1", "Bad key!", 3, "cfg-0-0-1-0"])).toEqual(["design-1", "cfg-0-0-1-0"]);
    expect(cleanLikes("x")).toEqual([]);
  });
  it("reads one like", () => {
    expect(cleanLike({ option: "design-2" })).toEqual({ option: "design-2", liked: true });
    expect(cleanLike({ option: "design-2", liked: false })).toEqual({ option: "design-2", liked: false });
    expect(cleanLike({ option: "<x>" })).toBeNull();
  });
  it("says it on the deal", () => {
    expect(likeRecordLine("Option 2")).toBe("The customer liked Option 2 on their proposal.");
  });
});
