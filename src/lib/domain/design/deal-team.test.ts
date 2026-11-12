import { describe, expect, it } from "vitest";
import {
  askFollowers,
  askNeedWords,
  asksSolOnDeal,
  briefHref,
  briefLines,
  cleanAsk,
  dealChatOrder,
  dealRoom,
  dealUnread,
  askWords,
  designAskFor,
  isFollowing,
  jobOfRoom,
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
    const got = designAskFor(lead, [
      { from: "note", text: "Enquiry from the website: bill about $480 a quarter, wants a battery for the evenings.", at: ago(0.1) },
    ]);
    expect(got?.ask.type).toBe("design");
    // Only what happened and what is needed; the words it rests on stay on the request.
    expect(got?.text).toBe("Tom's enquiry is in. Design required.");
    expect(got?.ask.why[0].text).toContain("Enquiry from the website: bill about $480 a quarter");
    expect(got?.ask.why[0].where).toBe("on the deal's notes");
    expect(designAskFor(lead, [{ from: "chat", text: "Could we get a battery?", at: ago(1) }])?.text).toBe(
      "Tom wrote in. Design required.",
    );
    expect(designAskFor(lead, [{ from: "call", text: "Wants a battery for the evenings.", at: ago(1) }])?.text).toBe(
      "Call with Tom complete. Design required.",
    );
  });

  it("reads a request kept in full before as the short one", () => {
    const why = [{ text: "New lead from Quick quote…", where: "on the deal's notes", at: ago(1) }];
    expect(
      askWords({
        text: 'I need a design for Michelle. Our notes say: "New lead from Quick quote…"',
        ask: { type: "design", want: "", why },
      }),
    ).toBe("Michelle's enquiry is in. Design required.");
    expect(askWords({ text: "A note.", ask: undefined })).toBe("A note.");
  });

  it("doesn't ask once there is a design, past designed, or with nothing to build on", () => {
    const said = [{ from: "chat" as const, text: "We'd like a battery", at: ago(2) }];
    expect(designAskFor({ ...lead, projectId: "prj_1" }, said)).toBeNull();
    expect(designAskFor({ ...lead, kw: 6.6 }, said)).toBeNull();
    expect(designAskFor({ ...lead, stage: "proposal" }, said)).toBeNull();
    expect(designAskFor({ ...lead, stage: "designed" }, said)).toBeNull();
    expect(designAskFor(lead, [{ from: "call", text: "Left a voicemail. Will try again tomorrow.", at: ago(1) }])).toBeNull();
    expect(designAskFor(lead, [])).toBeNull();
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

describe("following a deal's chat", () => {
  it("lets a choice win over being the owner", () => {
    expect(isFollowing(null, true)).toBe(true);
    expect(isFollowing(null, false)).toBe(false);
    expect(isFollowing(false, true)).toBe(false);
    expect(isFollowing(true, false)).toBe(true);
  });

  it("sends a request to the people whose job it is", () => {
    const members = [
      { email: "Owner@x.example", role: "owner", prices: true },
      { email: "dee@x.example", role: "designer", prices: false },
      { email: "pat@x.example", role: "member", prices: true },
      { email: "sam@x.example", role: "member", prices: false },
    ];
    expect(askFollowers("design", members)).toEqual(["dee@x.example"]);
    expect(
      askFollowers(
        "design",
        members.filter((m) => m.role !== "designer"),
      ),
    ).toEqual(["owner@x.example"]);
    expect(askFollowers("price", members)).toEqual(["owner@x.example", "pat@x.example"]);
    expect(askFollowers("other", members)).toEqual(["owner@x.example"]);
  });

  it("counts others' lines since last seen, a day back when never seen", () => {
    const lines = [
      { by: "sol", at: ago(30) },
      { by: "sol", at: ago(2) },
      { by: "me@x.example", at: ago(1) },
      { by: "sam@x.example", at: ago(0.5) },
    ];
    expect(dealUnread(lines, null, "Me@x.example", now)).toBe(2);
    expect(dealUnread(lines, ago(1), "me@x.example", now)).toBe(1);
  });

  it("puts unread first, then the latest, and names its room", () => {
    const line = (jobId: string, unread: number, at: string) => ({
      jobId,
      customer: "",
      title: "",
      unread,
      last: { by: "", text: "", at },
    });
    expect(dealChatOrder([line("a", 0, ago(1)), line("b", 2, ago(5)), line("c", 0, ago(0.5))]).map((d) => d.jobId)).toEqual([
      "b",
      "c",
      "a",
    ]);
    expect(dealRoom("job_abc12345")).toBe("deal:job_abc12345");
    expect(jobOfRoom("deal:job_abc12345")).toBe("job_abc12345");
    expect(jobOfRoom("deals")).toBeNull();
  });
});
