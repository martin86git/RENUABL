import { describe, expect, it } from "vitest";
import {
  askNeedWords,
  asksSolOnDeal,
  briefHref,
  briefLines,
  cleanAsk,
  designAskFor,
  openAsks,
  padOf,
  saidWhen,
  typingMention,
  wantsFrom,
  writerName,
  type DealLine,
} from "./deal-team";

const now = new Date("2026-11-08T02:00:00Z");
const ago = (h: number) => new Date(now.getTime() - h * 3_600_000).toISOString();
const line = (id: string, kind: DealLine["kind"] = "line", done = false): DealLine => ({
  id,
  jobId: "job_1",
  by: kind === "line" ? "sam@sunny.example" : "sol",
  kind,
  text: id,
  at: ago(1),
  ...(kind === "ask" ? { ask: { type: "design", want: "A design", why: [], ...(done ? { done: { by: "sam", at: ago(0) } } : {}) } } : {}),
});

describe("the design request", () => {
  const lead = { stage: "lead", projectId: null, kw: null, customerFirst: "Tom" };

  it("asks for a design from what the customer said, quoting them with where and when", () => {
    const got = designAskFor(
      lead,
      [{ from: "note", text: "Enquiry from the website: bill about $480 a quarter, wants a battery for the evenings.", at: ago(0.1) }],
      now,
    );
    expect(got?.ask.type).toBe("design");
    expect(got?.text).toContain("I need a design for Tom");
    expect(got?.text).toContain('"Enquiry from the website: bill about $480 a quarter');
    expect(got?.text).toContain("on the deal's notes, today");
    expect(got?.ask.why[0].where).toBe("on the deal's notes");
    expect(got?.text).toContain("Our notes say");
    expect(designAskFor(lead, [{ from: "chat", text: "Could we get a battery?", at: ago(1) }], now)?.text).toContain(
      'Tom wrote: "Could we get a battery?" (in the proposal chat, today)',
    );
  });

  it("doesn't ask once there is a design, past designed, or with nothing to build on", () => {
    const said = [{ from: "chat" as const, text: "We'd like a battery", at: ago(2) }];
    expect(designAskFor({ ...lead, projectId: "prj_1" }, said, now)).toBeNull();
    expect(designAskFor({ ...lead, kw: 6.6 }, said, now)).toBeNull();
    expect(designAskFor({ ...lead, stage: "proposal" }, said, now)).toBeNull();
    expect(designAskFor({ ...lead, stage: "designed" }, said, now)).toBeNull();
    expect(designAskFor(lead, [{ from: "call", text: "Left a voicemail. Will try again tomorrow.", at: ago(1) }], now)).toBeNull();
    expect(designAskFor(lead, [], now)).toBeNull();
  });

  it("puts the customer's own chat lines first, then the latest notes, at most three", () => {
    const got = wantsFrom([
      { from: "note", text: "Bill $600 a quarter", at: ago(1) },
      { from: "call", text: "Wants solar on the north roof", at: ago(3) },
      { from: "chat", text: "Can we add an EV charger too?", at: ago(10) },
      { from: "note", text: "Tiled roof, two storey", at: ago(2) },
      { from: "chat", text: "Thanks!", at: ago(0.5) },
    ]);
    expect(got.map((q) => q.text)).toEqual(["Can we add an EV charger too?", "Bill $600 a quarter", "Tiled roof, two storey"]);
    expect(got[0].where).toBe("in the proposal chat");
  });

  it("writes the brief for the designer", () => {
    const lines = briefLines(
      { type: "design", want: "A roof design for Tom.", why: [{ text: "Wants a battery", where: "in the call notes", at: ago(30) }] },
      now,
    );
    expect(lines[0]).toBe("A roof design for Tom.");
    expect(lines[1]).toBe('"Wants a battery" (in the call notes, yesterday)');
    expect(briefHref("job_1", "dl_abc12345")).toBe("/design/roof?job=job_1&ask=dl_abc12345");
  });
});

describe("requests and lines", () => {
  it("keeps only a well-formed request", () => {
    expect(cleanAsk({ type: "design", want: "A design", why: [{ text: "x", where: "in the chat", at: ago(1) }, { text: "" }] })).toEqual({
      type: "design",
      want: "A design",
      why: [{ text: "x", where: "in the chat", at: ago(1) }],
    });
    expect(cleanAsk({ type: "hack", want: "x" })).toBeNull();
    expect(cleanAsk({ type: "design", want: " " })).toBeNull();
    expect(cleanAsk({ type: "price", want: "p", done: { by: "sam@x.example", at: ago(1) } })?.done?.by).toBe("sam@x.example");
  });

  it("counts open requests and keeps one in view on the pad", () => {
    const lines = [line("dl_ask", "ask"), line("a"), line("b"), line("c"), line("d")];
    expect(openAsks(lines).map((l) => l.id)).toEqual(["dl_ask"]);
    expect(padOf(lines).map((l) => l.id)).toEqual(["dl_ask", "c", "d"]);
    expect(padOf([line("a"), line("b")]).map((l) => l.id)).toEqual(["a", "b"]);
    expect(openAsks([line("x", "ask", true)])).toEqual([]);
    expect(padOf(lines, 1).map((l) => l.id)).toEqual(["dl_ask"]);
  });

  it("names writers, hears @Sol and the @word being typed", () => {
    expect(writerName("sol")).toBe("Sol");
    expect(writerName("sam.jones@sunny.example")).toBe("Sam Jones");
    expect(asksSolOnDeal("@Sol what's the roof?")).toBe(true);
    expect(asksSolOnDeal("solar@sol.example")).toBe(false);
    expect(typingMention("Hi @sa", 6)).toEqual({ start: 3, query: "sa" });
    expect(typingMention("Hi sam", 6)).toBeNull();
    expect(askNeedWords({ type: "design" })).toBe("Sol needs a design");
  });

  it("says when in Melbourne's days", () => {
    expect(saidWhen(ago(0.5), now)).toBe("today");
    expect(saidWhen("2026-11-03T02:00:00Z", now)).toBe("3 Nov");
  });
});
