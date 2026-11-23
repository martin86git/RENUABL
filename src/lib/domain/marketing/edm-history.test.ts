import { describe, expect, it } from "vitest";
import { HISTORY_MAX, TYPING_PAUSE_MS, emptyHistory, record, redo, undo } from "./edm-history";

describe("email editor undo", () => {
  it("undoes and redoes each change in turn", () => {
    let h = emptyHistory<string>();
    h = record(h, "a", null, 0);
    h = record(h, "b", null, 10);
    const u1 = undo(h, "c")!;
    expect(u1.value).toBe("b");
    const u2 = undo(u1.history, "b")!;
    expect(u2.value).toBe("a");
    expect(undo(u2.history, "a")).toBeNull();
    const r = redo(u2.history, "a")!;
    expect(r.value).toBe("b");
    expect(redo(r.history, "b")!.value).toBe("c");
  });

  it("keeps typing in one field as one step, and starts another after a pause or in another field", () => {
    let h = emptyHistory<string>();
    h = record(h, "", "text:1", 0);
    h = record(h, "H", "text:1", 200);
    h = record(h, "He", "text:1", 400);
    expect(h.past).toEqual([""]);
    h = record(h, "Hey", "text:1", 400 + TYPING_PAUSE_MS);
    expect(h.past).toEqual(["", "Hey"]);
    h = record(h, "Hey!", "subject", 400 + TYPING_PAUSE_MS + 10);
    expect(h.past).toEqual(["", "Hey", "Hey!"]);
  });

  it("clears redo on a new change, and keeps at most the limit", () => {
    let h = emptyHistory<number>();
    for (let i = 0; i < HISTORY_MAX + 5; i++) h = record(h, i, null, i);
    expect(h.past).toHaveLength(HISTORY_MAX);
    const u = undo(h, -1)!;
    expect(u.history.future).toEqual([-1]);
    expect(record(u.history, 7, null, 0).future).toEqual([]);
  });
});
