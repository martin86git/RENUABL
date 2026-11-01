import { describe, expect, it } from "vitest";
import type { SolTurn } from "./sol";
import { MAX_PAST, askToStartAfresh, cleanPast, fileAway, freshTurns, pastGroup, titleOf, worthKeeping, type SolPast } from "./sol-history";

const you = (text: string, at: string, pinned = false): SolTurn => ({ role: "you", text, at, ...(pinned ? { pinned } : {}) });
const sol = (text: string, at: string): SolTurn => ({ role: "sol", text, at });

describe("Sol's past conversations", () => {
  const talk = [you("Which proposals should I chase first?", "2026-11-01T05:00:00Z"), sol("Chase Taylor first.", "2026-11-01T05:00:05Z")];

  it("files the conversation away under the member's first question, newest first", () => {
    const past = fileAway([], talk, "a1");
    expect(past[0]).toMatchObject({ id: "a1", title: "Which proposals should I chase first?", startedAt: talk[0].at, endedAt: talk[1].at });
    expect(fileAway(past, talk, "a2").map((p) => p.id)).toEqual(["a2", "a1"]);
  });

  it("keeps nothing when the member said nothing (Sol's reminders alone)", () => {
    expect(worthKeeping([sol("Reminder: call Olivia.", "2026-11-01T05:00:00Z")])).toBe(false);
    expect(fileAway([], [sol("Reminder", "2026-11-01T05:00:00Z")], "a1")).toEqual([]);
  });

  it("keeps the newest ones only", () => {
    let past: SolPast[] = [];
    for (let i = 0; i < MAX_PAST + 5; i++) past = fileAway(past, talk, `p${i}`);
    expect(past).toHaveLength(MAX_PAST);
    expect(past[0].id).toBe(`p${MAX_PAST + 4}`);
  });

  it("carries pinned messages on into a new chat", () => {
    expect(freshTurns([...talk, you("Keep this", "2026-11-01T05:01:00Z", true)])).toEqual([you("Keep this", "2026-11-01T05:01:00Z", true)]);
  });

  it("names a conversation by its first question, on one line and not too long", () => {
    expect(titleOf([you("  Line one\nline two  ", "2026-11-01T05:00:00Z")])).toBe("Line one line two");
    expect(titleOf([you("x".repeat(100), "2026-11-01T05:00:00Z")])).toHaveLength(70);
    expect(titleOf([])).toBe("A conversation with Sol");
  });

  it("asks to carry on or start afresh only after a while away", () => {
    const at = new Date("2026-11-01T05:00:05Z");
    expect(askToStartAfresh(talk, new Date(at.getTime() + 3 * 3_600_000))).toBe(false);
    expect(askToStartAfresh(talk, new Date(at.getTime() + 5 * 3_600_000))).toBe(true);
    expect(askToStartAfresh([], new Date(at.getTime() + 50 * 3_600_000))).toBe(false);
  });

  it("groups them by the market's day", () => {
    const now = new Date("2026-11-01T10:00:00Z"); // 9 pm in Melbourne
    expect(pastGroup("2026-11-01T01:00:00Z", now)).toBe("Today");
    expect(pastGroup("2026-10-31T01:00:00Z", now)).toBe("Yesterday");
    expect(pastGroup("2026-10-28T01:00:00Z", now)).toBe("This week");
    expect(pastGroup("2026-09-10T01:00:00Z", now)).toBe("September 2026");
  });

  it("reads back only well-formed conversations", () => {
    expect(cleanPast([{ id: "a", turns: talk }, { id: "", turns: talk }, { id: "b", turns: [] }, "junk"]).map((p) => p.id)).toEqual(["a"]);
  });
});
