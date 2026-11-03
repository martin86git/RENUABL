import { describe, expect, it } from "vitest";
import {
  actionFrom,
  actionRefusal,
  actionWords,
  cleanAction,
  cleanCatchUp,
  dealTag,
  dealThread,
  handOffLine,
  mayHoldWork,
  othersLines,
  topicWords,
  whoAnswers,
  workPrompt,
} from "./sol-chat-work";

const deals = new Map([["job_1", "Chloe Tran · Solar"]]);
const base = { asker: "Sam@x.com", deals, today: "2026-11-03", dueAt: (s: string) => (s ? "2026-11-07T22:00:00.000Z" : null) };

describe("a line that might hold work", () => {
  it("is one in a channel saying something should happen", () => {
    expect(mayHoldWork(true, "Chloe's install is moving to Thursday")).toBe(true);
    expect(mayHoldWork(true, "remind me Friday to call the Lees")).toBe(true);
    expect(mayHoldWork(true, "put a note on Smith: switchboard needs an upgrade")).toBe(true);
  });
  it("isn't chat, a short word, or a direct conversation", () => {
    expect(mayHoldWork(true, "great work today everyone")).toBe(false);
    expect(mayHoldWork(true, "moved")).toBe(false);
    expect(mayHoldWork(false, "Chloe's install is moving to Thursday")).toBe(false);
  });
});

describe("what Sol offers from his reading", () => {
  it("is a deal he was shown, on a real day to come", () => {
    const a = actionFrom({ action: "install-date", deal_id: "job_1", date: "2026-11-06", when_local: "", text: "" }, base);
    expect(a).toEqual({ kind: "install-date", jobId: "job_1", deal: "Chloe Tran · Solar", date: "2026-11-06", for: "sam@x.com" });
    expect(actionWords(a!)).toMatch(/^Move Chloe Tran · Solar's install to Fri, 6 Nov$/);
  });
  it("is nothing for a deal he wasn't shown, a past day, or none", () => {
    expect(actionFrom({ action: "install-date", deal_id: "job_9", date: "2026-11-06" }, base)).toBeNull();
    expect(actionFrom({ action: "install-date", deal_id: "job_1", date: "2026-10-01" }, base)).toBeNull();
    expect(actionFrom({ action: "none" }, base)).toBeNull();
    expect(actionFrom(null, base)).toBeNull();
  });
  it("is a note in words, or a reminder with a time", () => {
    expect(actionFrom({ action: "note", deal_id: "job_1", text: "Switchboard needs an upgrade" }, base)?.text).toBe(
      "Switchboard needs an upgrade",
    );
    expect(actionFrom({ action: "note", deal_id: "job_1", text: " " }, base)).toBeNull();
    expect(actionFrom({ action: "reminder", text: "Call the Lees", when_local: "2026-11-08 09:00" }, base)?.dueAt).toBe(
      "2026-11-07T22:00:00.000Z",
    );
    expect(actionFrom({ action: "reminder", text: "Call the Lees", when_local: "" }, base)).toBeNull();
  });
  it("is asked never to invent a deal, a day or a fact", () => {
    expect(workPrompt({ asker: "Sam", line: "x", today: "2026-11-03", deals: "", context: "" })).toMatch(/Never invent a deal/);
  });
});

describe("a kept action", () => {
  it("reads back as it was, and anything malformed is none", () => {
    const a = {
      kind: "note",
      jobId: "job_1",
      deal: "Chloe",
      text: "Hi",
      for: "sam@x.com",
      done: { by: "ash@x.com", at: "2026-11-03T01:00:00Z" },
    };
    expect(cleanAction(a)).toEqual(a);
    for (const bad of [null, {}, { kind: "delete", for: "x" }, { kind: "install-date", jobId: "j", date: "soon", for: "x" }])
      expect(cleanAction(bad)).toBeNull();
  });
  it("is pressed once; a reminder only by the person it's for", () => {
    const r = cleanAction({ kind: "reminder", text: "Call", dueAt: "2026-11-07T22:00:00Z", for: "sam@x.com" })!;
    expect(actionRefusal(r, "Sam@x.com")).toBeNull();
    expect(actionRefusal(r, "ash@x.com")).toMatch(/Only the person/);
    expect(actionRefusal({ ...r, done: { by: "sam@x.com", at: "t" } }, "sam@x.com")).toMatch(/already done/);
  });
});

describe("catching up", () => {
  it("reads others' lines, never the reader's own", () => {
    expect(othersLines([{ by: "sam@x.com" }, { by: "ash@x.com" }, { by: "sol" }], "Sam@x.com")).toEqual([
      { by: "ash@x.com" },
      { by: "sol" },
    ]);
  });
  it("is always something to show", () => {
    expect(cleanCatchUp({}, 4)).toEqual({ lines: 4, changed: "Nothing much.", decided: "", waiting: "" });
  });
});

describe("a deal's own thread with Sol", () => {
  it("is the questions asked from that deal and their answers, tag taken off", () => {
    const tag = dealTag({ id: "job_1", name: "Chloe Tran · Solar" });
    expect(tag).toBe("#Chloe Tran · Solar (job_1)");
    const turns = [
      { role: "you" as const, text: "What's on today?" },
      { role: "sol" as const, text: "Two installs." },
      { role: "you" as const, text: `${tag}\nWhere is it up to?` },
      { role: "sol" as const, text: "Proposal sent." },
      { role: "you" as const, text: `${dealTag({ id: "job_2", name: "Lee" })}\nAnd this one?` },
      { role: "sol" as const, text: "A lead." },
    ];
    expect(dealThread(turns, "job_1")).toEqual([
      { role: "you", text: "Where is it up to?" },
      { role: "sol", text: "Proposal sent." },
    ]);
  });
});

describe("who answers what", () => {
  const history = [
    { id: "a", by: "sam@x.com", text: "What's the AusNet export limit for single phase?" },
    { id: "b", by: "jo@x.com", text: "5 kW per phase usually" },
    { id: "c", by: "ash@x.com", text: "Does AusNet need pre-approval for a battery?" },
    { id: "d", by: "jo@x.com", text: "Yes, through their portal" },
    { id: "e", by: "sam@x.com", text: "Anyone free Thursday for the Lee install?" },
    { id: "f", by: "kim@x.com", text: "I am" },
  ];
  const members = ["sam@x.com", "jo@x.com", "ash@x.com", "kim@x.com"];
  it("names the teammate who usually answers that kind of question", () => {
    expect(whoAnswers("What's the AusNet export limit on a three phase home?", history, "ash@x.com", members)).toBe("jo@x.com");
    expect(handOffLine("jo", "Jo")).toBe("@jo usually answers these. Jo, can you help with this one?");
  });
  it("names nobody when nothing stands out, for the asker themself, or for someone who has left", () => {
    expect(whoAnswers("When is the staff barbecue?", history, "ash@x.com", members)).toBeNull();
    expect(whoAnswers("AusNet export limit question again?", history, "jo@x.com", members)).toBeNull();
    expect(whoAnswers("What's the AusNet export limit on three phase?", history, "ash@x.com", ["sam@x.com", "ash@x.com"])).toBeNull();
  });
  it("reads a line's topic without tags or common words", () => {
    expect([...topicWords("@jo what about the AusNet batteries?")]).toEqual(["ausnet", "batterie"]);
  });
});
