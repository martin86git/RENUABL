import { describe, expect, it } from "vitest";
import { cleanTurns, solSystem } from "./sol";
import {
  BLOCKED_SITES,
  QUESTION_AREAS,
  STARTER_QUESTIONS,
  answerSources,
  cleanKnowledgeInput,
  cleanSources,
  guessTopic,
  isStale,
  keyWords,
  memoryUsed,
  recallKnowledge,
  recallLines,
  reliedOn,
  takeSourcesList,
  urlKey,
  type KnowledgeEntry,
} from "./sol-knowledge";

const entry = (over: Partial<KnowledgeEntry>): KnowledgeEntry => ({
  id: "know_1",
  topic: "network",
  question: "What is the export limit on the AusNet Services network?",
  answer: "5 kW per phase for most homes, more with flexible exports.",
  sources: [{ url: "https://www.ausnetservices.com.au/solar", title: "Solar connections", from: "memory" }],
  savedBy: "sam@example.com",
  savedAt: "2026-10-01T00:00:00.000Z",
  uses: 0,
  usedAt: null,
  ...over,
});

describe("what Sol is asked, and where he looks", () => {
  it("covers networks, approvals, rebates, technical, products and wholesalers, each with examples", () => {
    expect(QUESTION_AREAS.map((a) => a.topic)).toEqual(["network", "approvals", "rebates", "technical", "product", "wholesaler"]);
    for (const a of QUESTION_AREAS) {
      expect(a.examples.length).toBeGreaterThanOrEqual(3);
      expect(a.where.length).toBeGreaterThan(20);
    }
    expect(STARTER_QUESTIONS).toHaveLength(QUESTION_AREAS.length);
  });

  it("is in his instructions: memory first, then the web, never a guess, never the business's own records", () => {
    const prompt = solSystem({ business: "Sunrise Solar", member: "Sam", costs: true, facts: "", prefs: [], now: new Date() });
    expect(prompt).toContain("call recall_knowledge before searching");
    expect(prompt).toContain("save_knowledge");
    expect(prompt).toMatch(/Never fill a gap with a figure you didn't find/);
    expect(prompt).toMatch(/Never save anything about the business's own customers, deals, prices or costs/);
  });

  it("never searches social media or question sites", () => {
    for (const s of ["facebook.com", "reddit.com", "quora.com"]) expect(BLOCKED_SITES).toContain(s);
    for (const s of BLOCKED_SITES) expect(s).toMatch(/^[a-z0-9-]+(\.[a-z0-9-]+)+$/);
  });
});

describe("recalling what he knows", () => {
  const kept = [
    entry({}),
    entry({
      id: "know_2",
      topic: "wholesaler",
      question: "Rexel Dandenong branch address and phone",
      answer: "Example details",
      savedAt: "2026-09-01T00:00:00.000Z",
    }),
  ];

  it("finds the answer that shares the question's words, the question counting most", () => {
    expect(recallKnowledge(kept, "what's the export limit with AusNet?").map((e) => e.id)).toEqual(["know_1"]);
    expect(recallKnowledge(kept, "phone number for Rexel Dandenong").map((e) => e.id)).toEqual(["know_2"]);
    expect(recallKnowledge(kept, "battery rebate amount")).toEqual([]);
  });

  it("folds plurals and drops empty words", () => {
    expect(keyWords("What are the batteries for the homes?")).toEqual(["battery", "home"]);
  });

  it("says how old each answer is and when to check it again, by topic", () => {
    const now = new Date("2026-11-01T00:00:00.000Z");
    expect(isStale(entry({ topic: "rebates", savedAt: "2026-09-01T00:00:00.000Z" }), now)).toBe(true);
    expect(isStale(entry({ topic: "technical", savedAt: "2026-09-01T00:00:00.000Z" }), now)).toBe(false);
    expect(recallLines([entry({ topic: "rebates", savedAt: "2026-09-01T00:00:00.000Z" })], now)).toContain("check it's still current");
    expect(recallLines([], now)).toBe("Nothing in memory answers that. Search the web.");
  });
});

describe("keeping an answer", () => {
  const read = new Set(["https://www.solar.vic.gov.au/battery-rebate"]);

  it("keeps it only with pages read in that answer", () => {
    const ok = cleanKnowledgeInput(
      {
        topic: "rebates",
        question: "What is the Solar Victoria battery rebate?",
        answer: "Example answer",
        sources: ["https://www.solar.vic.gov.au/battery-rebate", "https://made-up.example/page"],
      },
      read,
    );
    expect(ok.ok && ok.value.sources.map((s) => s.url)).toEqual(["https://www.solar.vic.gov.au/battery-rebate"]);
    const none = cleanKnowledgeInput(
      { topic: "rebates", question: "What is the rebate?", answer: "A guess", sources: ["https://made-up.example/page"] },
      read,
    );
    expect(none.ok).toBe(false);
  });

  it("puts an unknown topic under Other", () => {
    const r = cleanKnowledgeInput({ topic: "gossip", question: "A question here", answer: "An answer", sources: [...read] }, read);
    expect(r.ok && r.value.topic).toBe("other");
  });

  it("guesses the topic of an answer kept by hand", () => {
    expect(guessTopic("How many STCs on a 6.6 kW system?")).toBe("rebates");
    expect(guessTopic("Export limit with Powercor")).toBe("network");
    expect(guessTopic("Rexel Clayton opening hours")).toBe("wholesaler");
    expect(guessTopic("How far from a window under AS/NZS 5139")).toBe("standards");
  });
});

describe("the sources under an answer", () => {
  it("keeps https pages once each, web first, then memory with when it was found", () => {
    const got = answerSources(
      [
        { url: "https://www.cer.gov.au/stc", title: "STCs" },
        { url: "https://www.cer.gov.au/stc", title: "again" },
        { url: "http://plain.example/x", title: "insecure" },
      ],
      [entry({})],
    );
    expect(got).toEqual([
      { url: "https://www.cer.gov.au/stc", title: "STCs", from: "web" },
      { url: "https://www.ausnetservices.com.au/solar", title: "Solar connections", from: "memory", at: "2026-10-01T00:00:00.000Z" },
    ]);
  });

  it("names a page by its site when it has no title", () => {
    expect(cleanSources([{ url: "https://www.fronius.com/en-au/x" }])[0].title).toBe("fronius.com");
  });

  it("are kept on his turns, and what he kept in memory with them", () => {
    const [t] = cleanTurns([
      {
        role: "sol",
        text: "The limit is 5 kW per phase.",
        at: "2026-11-01T00:00:00.000Z",
        sources: [{ url: "https://www.ausnetservices.com.au/solar", title: "Solar", from: "web" }, { url: "javascript:alert(1)" }],
        remembered: [{ id: "know_1", question: "Export limit with AusNet?" }],
      },
    ]);
    expect(t.sources).toEqual([{ url: "https://www.ausnetservices.com.au/solar", title: "Solar", from: "web" }]);
    expect(t.remembered).toEqual([{ id: "know_1", question: "Export limit with AusNet?" }]);
  });
});

describe("his own list of sources", () => {
  it("is taken off the end of the answer, with titles allowed beside the addresses", () => {
    const got = takeSourcesList(
      "Up to 5 kW a phase.\n\nSources:\n- AusNet, connections: https://www.ausnetservices.com.au/connections/\n- https://cer.gov.au/stc.",
    );
    expect(got.text).toBe("Up to 5 kW a phase.");
    expect(got.urls).toEqual(["https://www.ausnetservices.com.au/connections/", "https://cer.gov.au/stc"]);
    expect(takeSourcesList("No list here.")).toEqual({ text: "No list here.", urls: [] });
  });

  it("keeps only pages he really saw, matched despite www and a trailing slash, and drops made-up ones", () => {
    const seen = [{ url: "https://ausnetservices.com.au/connections", title: "Connections" }];
    expect(reliedOn(["https://www.ausnetservices.com.au/connections/", "https://made-up.example/x"], seen)).toEqual(seen);
    expect(urlKey("https://WWW.Example.com/a/#top")).toBe("example.com/a");
  });

  it("counts a saved answer as used when he listed one of its pages, or all he recalled when he listed none", () => {
    const e = entry({});
    expect(memoryUsed(["https://ausnetservices.com.au/solar"], [e])).toEqual([e]);
    expect(memoryUsed(["https://cer.gov.au/stc"], [e])).toEqual([]);
    expect(memoryUsed([], [e])).toEqual([e]);
  });
});
