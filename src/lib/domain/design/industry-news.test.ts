import { describe, expect, it } from "vitest";
import {
  MAX_PER_RUN,
  cleanDay,
  cleanNewsItems,
  newsDayGroup,
  newsDue,
  newsPrompt,
  namesMaker,
  newsShown,
  onYourLists,
  onYourListsWords,
  wholeSentences,
  cleanStanding,
  isOfficialSite,
  NOT_OFFICIAL_NOTE,
  readNewsJson,
  type NewsItem,
} from "./industry-news";

const today = "2026-11-10";
const story = (over: Record<string, unknown> = {}) => ({
  topic: "companies",
  headline: "An inverter maker winds down its Australian operations",
  summary: "The company says it will stop selling in Australia. Support for systems already installed is to be confirmed.",
  meaning: "Customers with this inverter may ask who covers its warranty.",
  url: "https://news.example.com/inverter-maker-leaves",
  publishedOn: "2026-11-08",
  brands: ["Maker A", "Maker A", ""],
  ...over,
});

describe("cleanNewsItems", () => {
  const seen = ["https://www.news.example.com/inverter-maker-leaves/"];

  it("keeps a story whose page the search showed, with that address", () => {
    const [n] = cleanNewsItems([story()], seen, [], today);
    expect(n.url).toBe(seen[0]);
    expect(n.brands).toEqual(["Maker A"]);
    expect(n.publishedOn).toBe("2026-11-08");
  });

  it("drops a link the search never showed", () => {
    expect(cleanNewsItems([story({ url: "https://made-up.example/story" })], seen, [], today)).toEqual([]);
  });

  it("drops social media, unknown topics, thin words, old stories and repeats", () => {
    const fb = "https://www.facebook.com/post/1";
    expect(cleanNewsItems([story({ url: fb })], [fb], [], today)).toEqual([]);
    expect(cleanNewsItems([story({ topic: "gossip" })], seen, [], today)).toEqual([]);
    expect(cleanNewsItems([story({ summary: "Short." })], seen, [], today)).toEqual([]);
    expect(cleanNewsItems([story({ publishedOn: "2026-10-01" })], seen, [], today)).toEqual([]);
    expect(cleanNewsItems([story(), story()], seen, [], today)).toHaveLength(1);
    expect(cleanNewsItems([story()], seen, ["news.example.com/inverter-maker-leaves"], today)).toEqual([]);
  });

  it("keeps no more than a day's worth", () => {
    const many = Array.from({ length: 20 }, (_, i) => story({ url: `https://n.example.com/${i}` }));
    const urls = many.map((s) => s.url as string);
    expect(cleanNewsItems(many, urls, [], today)).toHaveLength(MAX_PER_RUN);
  });

  it("answers nothing for something that isn't a list", () => {
    expect(cleanNewsItems({ a: 1 }, seen, [], today)).toEqual([]);
  });
});

describe("cleanDay", () => {
  it("reads a day and refuses one after today", () => {
    expect(cleanDay("2026-11-09T10:00:00Z", today)).toBe("2026-11-09");
    expect(cleanDay("2026-11-11", today)).toBeNull();
    expect(cleanDay("last week", today)).toBeNull();
  });
});

describe("readNewsJson", () => {
  it("reads the fenced list at the end", () => {
    expect(readNewsJson('Here you go.\n```json\n[{"a":1}]\n```')).toEqual([{ a: 1 }]);
  });
  it("reads a bare list, or { stories }", () => {
    expect(readNewsJson('Stories: [{"a":2}]')).toEqual([{ a: 2 }]);
    expect(readNewsJson('```json\n{"stories":[{"a":3}]}\n```')).toEqual([{ a: 3 }]);
  });
  it("answers null when there is no list", () => {
    expect(readNewsJson("Nothing new today.")).toBeNull();
  });
});

describe("newsDue", () => {
  const now = new Date("2026-11-10T08:00:00Z");
  it("is due when never read, after a day, or an hour after a failure", () => {
    expect(newsDue(null, now)).toBe(true);
    expect(newsDue({ startedAt: "2026-11-09T08:00:00Z", ok: true }, now)).toBe(true);
    expect(newsDue({ startedAt: "2026-11-10T02:00:00Z", ok: true }, now)).toBe(false);
    expect(newsDue({ startedAt: "2026-11-10T07:30:00Z", ok: false }, now)).toBe(false);
    expect(newsDue({ startedAt: "2026-11-10T06:30:00Z", ok: false }, now)).toBe(true);
  });
  it("waits for a reading under way, unless it has died", () => {
    expect(newsDue({ startedAt: "2026-11-10T07:55:00Z", ok: null }, now)).toBe(false);
    expect(newsDue({ startedAt: "2026-11-10T07:00:00Z", ok: null }, now)).toBe(true);
  });
});

describe("the feed", () => {
  const item = (id: string, topic: NewsItem["topic"], publishedOn: string | null, foundAt = "2026-11-10T00:00:00Z"): NewsItem => ({
    id,
    topic,
    headline: id,
    summary: "",
    meaning: "",
    url: "",
    site: "",
    publishedOn,
    brands: [],
    standing: null,
    standingNote: "",
    foundAt,
  });

  it("shows newest first, by topic", () => {
    const all = [item("a", "rebates", "2026-11-01"), item("b", "companies", "2026-11-09"), item("c", "rebates", null)];
    expect(newsShown(all, "all").map((n) => n.id)).toEqual(["c", "b", "a"]);
    expect(newsShown(all, "rebates").map((n) => n.id)).toEqual(["c", "a"]);
  });

  it("groups by day", () => {
    expect(newsDayGroup(item("x", "rules", "2026-11-10"), today)).toBe("Today");
    expect(newsDayGroup(item("x", "rules", "2026-11-09"), today)).toBe("Yesterday");
    expect(newsDayGroup(item("x", "rules", "2026-11-06"), today)).toBe("This week");
    expect(newsDayGroup(item("x", "rules", "2026-10-20"), today)).toBe("Earlier");
  });

  it("asks for own words and real links, and lists what's already in", () => {
    const p = newsPrompt(today, ["Old story"]);
    expect(p).toMatch(/own words/);
    expect(p).toMatch(/Never make up/);
    expect(p).toContain("- Old story");
  });
});

describe("makers on the business's lists", () => {
  it("matches a maker as whole words, written either way", () => {
    expect(namesMaker("SolarEdge SE5000H-AU inverter", "SolarEdge")).toBe(true);
    expect(namesMaker("Solar Edge SE8K", "SolarEdge")).toBe(true);
    expect(namesMaker("SolarEdge Home Battery", "Solar Edge")).toBe(true);
    expect(namesMaker("Edgeworth rail kit", "SolarEdge")).toBe(false);
    expect(namesMaker("Sungrow SH5.0RS", "Sun")).toBe(false);
  });

  it("never counts a general word as a maker", () => {
    expect(namesMaker("Solar panel clamp", "Solar")).toBe(false);
    expect(namesMaker("Energy meter", "Energy")).toBe(false);
    expect(namesMaker("LG Chem RESU", "LG")).toBe(false);
  });

  it("counts each product once and gives a few names", () => {
    const products = [
      { sku: "SE5000H", name: "SolarEdge SE5000H" },
      { sku: "SE5000H", name: "SolarEdge SE5000H" },
      { sku: "SE8K", name: "SolarEdge SE8K" },
      { sku: "JKM475", name: "Jinko 475 W" },
    ];
    const m = onYourLists(["SolarEdge", "Tesla"], products)!;
    expect(m.count).toBe(2);
    expect(m.makers).toEqual(["SolarEdge"]);
    expect(onYourListsWords(m)).toBe("2 SolarEdge products on your price lists");
    expect(onYourLists(["Tesla"], products)).toBeNull();
  });
});

describe("wholeSentences", () => {
  it("ends a long summary at its last whole sentence", () => {
    const s = "First sentence here. Second one is longer and goes on. Third is cut off midway";
    expect(wholeSentences(s, 60)).toBe("First sentence here. Second one is longer and goes on.");
    expect(wholeSentences("Short.", 60)).toBe("Short.");
  });
  it("falls back to a word and an ellipsis when there is no sentence end", () => {
    expect(wholeSentences("one two three four five six", 15)).toBe("one two three…");
  });
});

describe("how sure a story is", () => {
  it("knows an official page", () => {
    expect(isOfficialSite("https://cer.gov.au/schemes/cheaper-home-batteries")).toBe(true);
    expect(isOfficialSite("https://www.solar.vic.gov.au/news")).toBe(true);
    expect(isOfficialSite("https://aemo.com.au/newsroom")).toBe(true);
    expect(isOfficialSite("https://www.finder.com.au/news/battery-rebate")).toBe(false);
    expect(isOfficialSite("https://notgov.au.example.com/x")).toBe(false);
  });

  it("keeps Sol's standing and his note", () => {
    expect(cleanStanding("rebates", "https://cer.gov.au/x", "confirmed", "Stated on the CER's own page.")).toEqual({
      standing: "confirmed",
      standingNote: "Stated on the CER's own page.",
    });
    expect(cleanStanding("rebates", "https://www.abc.net.au/x", "unconfirmed", "A press report.").standing).toBe("unconfirmed");
    expect(cleanStanding("companies", "https://news.example.com/x", "confirmed", "The company announced it.").standing).toBe("confirmed");
  });

  it("never calls a rebate, rule or network story confirmed from a page that isn't official", () => {
    expect(cleanStanding("rebates", "https://www.finder.com.au/news/x", "confirmed", "Finder says so.")).toEqual({
      standing: "reported",
      standingNote: NOT_OFFICIAL_NOTE,
    });
    expect(cleanStanding("networks", "https://reneweconomy.com.au/x", "confirmed", "").standing).toBe("reported");
  });

  it("reads anything else as unconfirmed", () => {
    expect(cleanStanding("products", "https://x.example.com", "probably", "").standing).toBe("unconfirmed");
  });

  it("carries the standing through cleanNewsItems", () => {
    const url = "https://www.abc.net.au/news/2026-11-07/battery-subsidy";
    const [n] = cleanNewsItems([story({ topic: "rebates", url, standing: "confirmed", standingNote: "x" })], [url], [], today);
    expect(n.standing).toBe("reported");
  });

  it("never takes a rebate, rule or network story from a comparison site", () => {
    const url = "https://www.finder.com.au/news/is-the-federal-home-battery-rebate-being-cut";
    expect(cleanNewsItems([story({ topic: "rebates", url })], [url], [], today)).toEqual([]);
    expect(cleanNewsItems([story({ topic: "companies", url })], [url], [], today)).toHaveLength(1);
  });

  it("asks for official pages and a standing", () => {
    const p = newsPrompt(today, []);
    expect(p).toMatch(/Never use comparison or lead sites/);
    expect(p).toMatch(/"standing"/);
  });
});
