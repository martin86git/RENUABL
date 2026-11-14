import { describe, expect, it } from "vitest";
import type { CoachTurn } from "./coaching";
import {
  MAX_COACH_CHATS,
  chatDayWords,
  chatLines,
  chatTitle,
  cleanCoachChats,
  currentChatLine,
  fileChatAway,
  forgetChat,
  isChatId,
  reopenChat,
} from "./coach-threads";

const you = (text: string, at = "2026-11-14T01:00:00.000Z"): CoachTurn => ({ role: "you", text, at });
const them = (text: string, at = "2026-11-14T01:00:05.000Z"): CoachTurn => ({ role: "assistant", text, at });
const id = (n: number) => `cc_${String(n).padStart(8, "0")}`;

describe("the assistant's chats, kept apart", () => {
  it("names a chat by the first thing said to the assistant, on one line", () => {
    expect(chatTitle([you("say  business hours\nare 9 to 5")])).toBe("say business hours are 9 to 5");
    expect(chatTitle([them("Hello"), you("pronounce it renewable")])).toBe("pronounce it renewable");
    expect(chatTitle([you("x".repeat(200))]).length).toBeLessThanOrEqual(64);
    expect(chatTitle([])).toBe("A chat");
  });

  it("says nothing of a chat nobody has spoken in", () => {
    expect(currentChatLine([])).toBeNull();
    expect(currentChatLine([them("Hello")])).toBeNull();
    expect(currentChatLine([you("hi", "2026-11-14T01:00:00.000Z"), them("Got it", "2026-11-14T01:00:09.000Z")])).toEqual({
      title: "hi",
      startedAt: "2026-11-14T01:00:00.000Z",
      endedAt: "2026-11-14T01:00:09.000Z",
      count: 2,
    });
  });

  it("files the chat going away, newest first, and keeps nothing empty", () => {
    const past = fileChatAway([], [you("first"), them("ok")], id(1));
    expect(chatLines(past)).toEqual([expect.objectContaining({ id: id(1), title: "first", count: 2 })]);
    expect(fileChatAway(past, [], id(2))).toEqual(past);
    const two = fileChatAway(past, [you("second")], id(2));
    expect(two.map((p) => p.id)).toEqual([id(2), id(1)]);
  });

  it("keeps only so many, the oldest going first", () => {
    let past = fileChatAway([], [you("0")], id(0));
    for (let i = 1; i <= MAX_COACH_CHATS + 3; i++) past = fileChatAway(past, [you(String(i))], id(i));
    expect(past).toHaveLength(MAX_COACH_CHATS);
    expect(past[0].title).toBe(String(MAX_COACH_CHATS + 3));
    expect(past.some((p) => p.id === id(0))).toBe(false);
  });

  it("opens an earlier chat again, filing the one going away in its place", () => {
    const past = fileChatAway(fileChatAway([], [you("old one")], id(1)), [you("older two")], id(2));
    const res = reopenChat(past, [you("the one going")], id(1), id(3));
    expect(res?.turns.map((t) => t.text)).toEqual(["old one"]);
    expect(res?.past.map((p) => p.title)).toEqual(["the one going", "older two"]);
    expect(reopenChat(past, [], id(9), id(3))).toBeNull();
    expect(reopenChat(past, [], id(2), id(3))?.past.map((p) => p.id)).toEqual([id(1)]);
  });

  it("forgets one", () => {
    const past = fileChatAway(fileChatAway([], [you("a")], id(1)), [you("b")], id(2));
    expect(forgetChat(past, id(2)).map((p) => p.id)).toEqual([id(1)]);
  });

  it("reads back only whole chats", () => {
    const raw = [
      { id: id(1), turns: [you("kept")] },
      { id: id(1), turns: [you("the same id again")] },
      { id: "nope", turns: [you("bad id")] },
      { id: id(2), turns: [{ role: "assistant", text: "nobody spoke", at: "x" }] },
      "junk",
    ];
    expect(cleanCoachChats(raw).map((c) => c.title)).toEqual(["kept"]);
    expect(cleanCoachChats(null)).toEqual([]);
    expect(isChatId("cc_0123abcd")).toBe(true);
    expect(isChatId("cc_XYZ")).toBe(false);
  });

  it("says when a chat was last added to, in the market's days", () => {
    const now = new Date("2026-11-14T03:00:00.000Z");
    const zone = "Australia/Melbourne";
    expect(chatDayWords("2026-11-14T01:00:00.000Z", now, zone)).toBe("today");
    // 11pm on the 13th in Melbourne.
    expect(chatDayWords("2026-11-13T12:00:00.000Z", now, zone)).toBe("yesterday");
    expect(chatDayWords("2026-11-10T01:00:00.000Z", now, zone)).toBe("10 Nov");
    expect(chatDayWords("junk", now, zone)).toBe("");
  });
});
