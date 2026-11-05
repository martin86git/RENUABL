import { describe, expect, it } from "vitest";
import { EMPTY_ORDER } from "./orders";
import {
  actionDoneWords,
  actionFrom,
  actionNotYours,
  actionQuestion,
  actionRefusal,
  actionWords,
  cleanAction,
  cleanCatchUp,
  dealTag,
  dealThread,
  handOffLine,
  matchProduct,
  mayHoldWork,
  othersLines,
  topicWords,
  whoAnswers,
  withOrderAdd,
  workPrompt,
} from "./sol-chat-work";

describe("asking Sol by name to change something", () => {
  it("reads order and stage lines only when he is asked", () => {
    expect(mayHoldWork(true, "add two more panels to Smith's order", true)).toBe(true);
    expect(mayHoldWork(true, "mark the Lees as installed please", true)).toBe(true);
    expect(mayHoldWork(true, "add two more panels to Smith's order")).toBe(false);
  });
  it("tells him of the order and stage changes only when asked", () => {
    const p = { asker: "Sam", line: "x", today: "2026-11-05", deals: "", context: "" };
    expect(workPrompt({ ...p, asked: true })).toMatch(/order-add/);
    expect(workPrompt({ ...p, asked: true })).toMatch(/installed: Installed/i);
    expect(workPrompt(p)).not.toMatch(/order-add/);
  });
  it("marks a deal at a stage only when it is a real one", () => {
    const a = actionFrom({ action: "stage", deal_id: "job_1", stage: "installed" }, base);
    expect(a).toEqual({ kind: "stage", jobId: "job_1", deal: "Chloe Tran · Solar", stage: "installed", for: "sam@x.com" });
    expect(actionQuestion(a!)).toBe("Mark Chloe Tran · Solar as Installed?");
    expect(actionDoneWords(a!)).toBe("Marked Installed");
    expect(actionFrom({ action: "stage", deal_id: "job_1", stage: "finished" }, base)).toBeNull();
    expect(cleanAction({ ...a, stage: "nope" })).toBeNull();
    expect(cleanAction(a)).toEqual(a);
  });
  it("adds to an order a number in range of a product in words", () => {
    const a = actionFrom({ action: "order-add", deal_id: "job_1", text: "Jinko panels", qty: 2 }, base);
    expect(a).toMatchObject({ kind: "order-add", jobId: "job_1", text: "Jinko panels", qty: 2 });
    expect(actionFrom({ action: "order-add", deal_id: "job_1", text: "panels", qty: 0 }, base)).toBeNull();
    expect(actionFrom({ action: "order-add", deal_id: "job_1", text: "panels", qty: 500 }, base)).toBeNull();
    expect(actionFrom({ action: "order-add", deal_id: "job_1", text: "", qty: 2 }, base)).toBeNull();
    // Kept only once the server has found the product.
    expect(cleanAction(a)).toBeNull();
    const found = { ...a!, sku: "JKM475", item: "Jinko 475 W panel", text: undefined };
    expect(cleanAction(found)).toMatchObject({ sku: "JKM475", item: "Jinko 475 W panel", qty: 2 });
    expect(actionQuestion(found)).toBe("Add 2 × Jinko 475 W panel to Chloe Tran · Solar's order?");
  });
  it("lets only someone who sees costs answer an order card", () => {
    const a = { kind: "order-add", jobId: "job_1", deal: "Chloe", item: "Panel", sku: "P", qty: 1, for: "sam@x.com" } as const;
    expect(actionRefusal(a, "jo@x.com", { costs: false })).toMatch(/Ordering Station/);
    expect(actionRefusal(a, "jo@x.com", { costs: true })).toBeNull();
    expect(actionNotYours(a, "jo@x.com", { costs: false })).toMatch(/Ordering Station/);
    expect(actionNotYours({ ...a, done: { by: "x", at: "y" } }, "jo@x.com", { costs: false })).toBeNull();
  });
});

describe("the product an order card adds", () => {
  const onOrder = [
    { sku: "JKM475N", item: "Jinko 475 W panel" },
    { sku: "SIG-8", item: "Sigenergy 8 kWh battery module" },
  ];
  const listed = [
    { sku: "ISO-40", item: "NHP 40 A isolator" },
    { sku: "ISO-63", item: "NHP 63 A isolator" },
  ];
  it("is the one product every word names, the order first", () => {
    expect(matchProduct("more Jinko panels", onOrder, listed)?.sku).toBe("JKM475N");
    expect(matchProduct("batteries", onOrder, listed)?.sku).toBe("SIG-8");
    expect(matchProduct("63 A isolator", onOrder, listed)?.sku).toBe("ISO-63");
  });
  it("is nothing when nothing or more than one answers", () => {
    expect(matchProduct("isolator", onOrder, listed)).toBeNull();
    expect(matchProduct("EV charger", onOrder, listed)).toBeNull();
    expect(matchProduct("", onOrder, listed)).toBeNull();
  });
});

describe("an order with more of a product", () => {
  const items = [{ key: "sku:JKM475N", qty: 20, worked: 20 }];
  it("raises a line the sale worked out", () => {
    expect(withOrderAdd(EMPTY_ORDER, items, { sku: "JKM475N", item: "Jinko", qty: 2 }).qty).toEqual({ "sku:JKM475N": 22 });
  });
  it("adds a product by hand, or more of one added before", () => {
    const once = withOrderAdd(EMPTY_ORDER, items, { sku: "ISO-40", item: "Isolator", qty: 1 });
    expect(once.added).toEqual([{ key: "sku:ISO-40", item: "Isolator", sku: "ISO-40", qty: 1 }]);
    expect(withOrderAdd(once, items, { sku: "ISO-40", item: "Isolator", qty: 2 }).added[0].qty).toBe(3);
  });
});

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
