import { describe, expect, it } from "vitest";
import { cleanFeedback, feedbackOrder, mayRemove, type FeedbackItem } from "./feedback";
import { UPDATES, newestDay, unseenUpdates, updatesByDay } from "./updates";

describe("updates", () => {
  const list = [
    { day: "2026-11-01", area: "A", words: "one" },
    { day: "2026-11-01", area: "A", words: "two" },
    { day: "2026-10-30", area: "B", words: "three" },
  ];
  it("groups by day, newest first, and counts what came in since last opened", () => {
    expect(updatesByDay(list).map((d) => [d.day, d.items.length])).toEqual([
      ["2026-11-01", 2],
      ["2026-10-30", 1],
    ]);
    expect(unseenUpdates(null, list)).toBe(2);
    expect(unseenUpdates("2026-10-30", list)).toBe(2);
    expect(unseenUpdates("2026-11-01", list)).toBe(0);
    expect(newestDay(list)).toBe("2026-11-01");
  });
  it("is written in plain words, never a file or function name", () => {
    for (const u of UPDATES) {
      expect(u.words).not.toMatch(/\.(ts|tsx)\b|[a-z][A-Z][a-z]+\(|\/api\//);
      expect(u.words.length).toBeLessThan(140);
    }
  });
});

describe("feedback", () => {
  const item = (id: string, at: string, doneAt: string | null, by = "sam@x.example"): FeedbackItem => ({
    id,
    kind: "Issue",
    text: "x",
    by,
    at,
    doneAt,
    doneBy: null,
    comments: [],
  });
  it("checks what is raised, puts open items first, and lets only the raiser or owner remove", () => {
    expect(cleanFeedback({ kind: "Request", text: "  Dark mode \n\n\n\nplease " })).toEqual({
      ok: true,
      kind: "Request",
      text: "Dark mode \n\nplease",
    });
    expect(cleanFeedback({ kind: "Bug", text: "x" }).ok).toBe(false);
    expect(cleanFeedback({ kind: "Issue", text: " " }).ok).toBe(false);
    const items = [item("a", "2026-11-01", "2026-11-02"), item("b", "2026-10-01", null), item("c", "2026-11-01", null)];
    expect(feedbackOrder(items, "all").map((i) => i.id)).toEqual(["c", "b", "a"]);
    expect(feedbackOrder(items, "done").map((i) => i.id)).toEqual(["a"]);
    expect([
      mayRemove(items[0], "SAM@x.example", false),
      mayRemove(items[0], "kim@x.example", false),
      mayRemove(items[0], "kim@x.example", true),
    ]).toEqual([true, false, true]);
  });
});
