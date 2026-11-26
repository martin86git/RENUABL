import { describe, expect, it } from "vitest";
import type { SolTurn } from "./sol";
import { MAX_TABS, addTab, answerCame, cleanTabs, tabTitle, tabTurns, tabWords, tabsGlance, withAnswers, type SolTab } from "./sol-tabs";

const tab = (over: Partial<SolTab> = {}): SolTab => ({
  id: "a",
  title: "Fault to earth",
  since: "2026-11-26T01:00:00.000Z",
  waitingSince: "2026-11-26T01:05:00.000Z",
  status: "writing",
  at: "2026-11-26T01:05:10.000Z",
  ...over,
});
const turn = (role: SolTurn["role"], at: string, room: SolTurn["room"] = "today"): SolTurn => ({ role, text: role, at, room });

describe("a tab's name", () => {
  it("is the first question, cut at a whole word", () => {
    expect(tabTitle("give me written instructions")).toBe("give me written instructions");
    expect(tabTitle("How do I find a fault to earth on a string of panels today")).toBe("How do I find a fault to earth on…");
    expect(tabTitle("   ")).toBe("Chat with Sol");
  });
});

describe("reading a tab back", () => {
  const turns = [
    turn("you", "2026-11-26T00:50:00.000Z"),
    turn("you", "2026-11-26T01:01:00.000Z"),
    turn("sol", "2026-11-26T01:02:00.000Z"),
    turn("sol", "2026-11-26T01:03:00.000Z", "service"),
  ];
  it("takes only Today's turns from when the chat began", () => {
    expect(tabTurns(turns, tab()).map((t) => t.at)).toEqual(["2026-11-26T01:01:00.000Z", "2026-11-26T01:02:00.000Z"]);
  });
  it("is ready once an answer comes after the question it waited on", () => {
    expect(answerCame(turns, tab())).toBe(false);
    const later = [...turns, turn("sol", "2026-11-26T01:06:00.000Z")];
    expect(answerCame(later, tab())).toBe(true);
    expect(withAnswers([tab()], later)[0]).toMatchObject({ status: "ready", waitingSince: null });
  });
  it("leaves a tab with nothing coming alone", () => {
    expect(withAnswers([tab({ status: "idle", waitingSince: null })], turns)[0].status).toBe("idle");
  });
});

describe("keeping tabs", () => {
  it("puts the newest first and drops the oldest quiet one past the most", () => {
    let all: SolTab[] = [];
    for (let i = 0; i < MAX_TABS; i++) all = addTab(all, tab({ id: `t${i}`, status: i === 1 ? "ready" : "idle" }));
    all = addTab(all, tab({ id: "new" }));
    expect(all).toHaveLength(MAX_TABS);
    expect(all[0].id).toBe("new");
    expect(all.map((t) => t.id)).not.toContain("t0");
    expect(all.map((t) => t.id)).toContain("t1");
  });
  it("reads back only whole tabs", () => {
    expect(cleanTabs([tab(), { id: "x" }, null, "no"])).toEqual([tab()]);
    expect(cleanTabs("no")).toEqual([]);
  });
});

describe("what a tab says", () => {
  const now = Date.parse("2026-11-26T01:15:10.000Z");
  it("says where it stands", () => {
    expect(tabWords(tab(), now)).toBe("Sol is writing it up…");
    expect(tabWords(tab({ status: "ready" }), now)).toBe("Answer ready");
    expect(tabWords(tab({ status: "idle" }), now)).toBe("Minimised · 10 min ago");
  });
  it("sums the tabs for the folded round", () => {
    expect(tabsGlance([tab(), tab({ id: "b", status: "ready" })])).toEqual({ count: 2, writing: true, ready: true });
  });
});

describe("a tab's turns, bounded", () => {
  const t = (role: "you" | "sol", at: string) => ({ role, text: "x", at, room: "today" }) as never;
  it("stops at the next chat's first question", () => {
    const turns = [t("you", "2026-11-26T01:00:00.000Z"), t("sol", "2026-11-26T01:05:00.000Z"), t("you", "2026-11-26T01:10:00.000Z")];
    const got = tabTurns(turns, { since: "2026-11-26T00:59:00.000Z", at: "2026-11-26T01:02:00.000Z" });
    expect(got.length).toBe(2);
  });
});
