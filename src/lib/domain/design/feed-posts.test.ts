import { describe, expect, it } from "vitest";
import {
  REPORT_HIDE,
  agoShort,
  authorWords,
  cleanPostLink,
  cleanPostText,
  hiddenByReports,
  kindWords,
  mergeFeed,
  pageTitle,
  postProblem,
  cleanPoll,
  pollFor,
  pollTimeWords,
  pollShare,
  talkedAbout,
  talkWords,
  type FeedPost,
} from "./feed-posts";
import type { NewsItem } from "./industry-news";

describe("what a post may say", () => {
  it("takes out a customer's email, phone and street address", () => {
    const t = cleanPostText("Finished at 12 Sample Street today, call 0412 345 678 or jo@example.com");
    expect(t).not.toMatch(/0412|jo@example|Sample Street/);
  });
  it("keeps ordinary words", () => {
    expect(cleanPostText("  Anyone seen the new Sungrow firmware?  ")).toBe("Anyone seen the new Sungrow firmware?");
  });
  it("needs words, a link or a photo, and a link that works", () => {
    expect(postProblem("", null, false, false)).toMatch(/Write something/);
    expect(postProblem("", null, true, false)).toBeNull();
    expect(postProblem("hi", null, false, true)).toMatch(/web address/);
  });
});

describe("cleanPostLink", () => {
  it("takes a public https link, adding https to a bare one", () => {
    expect(cleanPostLink("https://pv-magazine-australia.com/x")).toBe("https://pv-magazine-australia.com/x");
    expect(cleanPostLink("reneweconomy.com.au/story")).toBe("https://reneweconomy.com.au/story");
  });
  it("refuses http, local addresses and other schemes", () => {
    expect(cleanPostLink("http://example.com")).toBeNull();
    expect(cleanPostLink("https://localhost/x")).toBeNull();
    expect(cleanPostLink("javascript:alert(1)")).toBeNull();
    expect(cleanPostLink("https://10.0.0.1/x")).toBeNull();
  });
});

describe("who wrote it", () => {
  it("is a first name and business, never an email", () => {
    expect(authorWords("Sam", "Sunrise Solar")).toBe("Sam · Sunrise Solar");
    expect(authorWords(null, "Sunrise Solar")).toBe("Sunrise Solar");
    expect(kindWords("installer")).toBe("Installer");
    expect(kindWords(undefined)).toBe("Solar retailer");
  });
});

describe("reports", () => {
  it(`hide a post at ${REPORT_HIDE} businesses`, () => {
    expect(hiddenByReports(REPORT_HIDE - 1)).toBe(false);
    expect(hiddenByReports(REPORT_HIDE)).toBe(true);
  });
});

describe("pageTitle", () => {
  it("reads og:title, else the title", () => {
    expect(pageTitle(`<meta property="og:title" content="Sungrow &amp; Co launch">`)).toBe("Sungrow & Co launch");
    expect(pageTitle("<title> A page </title>")).toBe("A page");
    expect(pageTitle("<p>none</p>")).toBeNull();
  });
});

describe("the feed", () => {
  const story = (id: string, publishedOn: string | null, foundAt: string): NewsItem => ({
    id,
    topic: "rebates",
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
  const post = (id: string, at: string) => ({ id, at }) as FeedPost;

  it("puts stories and posts together, newest first", () => {
    const entries = mergeFeed(
      [story("s-old", "2026-11-06", "2026-11-10T00:00:00Z"), story("s-new", "2026-11-10", "2026-11-10T01:00:00Z")],
      [post("p", "2026-11-10T03:00:00Z"), post("p-old", "2026-11-08T03:00:00Z")],
    );
    expect(entries.map((e) => (e.kind === "story" ? e.item.id : e.post.id))).toEqual(["p", "s-new", "p-old", "s-old"]);
  });

  it("says how long ago", () => {
    const now = new Date("2026-11-10T03:00:00Z");
    expect(agoShort("2026-11-10T02:59:40Z", now)).toBe("just now");
    expect(agoShort("2026-11-10T02:40:00Z", now)).toBe("20 min ago");
    expect(agoShort("2026-11-10T00:00:00Z", now)).toBe("3 h ago");
  });
});

describe("polls", () => {
  const now = new Date("2026-11-16T10:00:00Z");

  it("keeps two to four different choices, cleaned", () => {
    expect(cleanPoll(["Sigenergy", "sigenergy", " "])).toBeNull();
    expect(cleanPoll(["Sigenergy", "Tesla", "Sungrow", "BYD", "Alpha"])).toEqual(["Sigenergy", "Tesla", "Sungrow", "BYD"]);
    expect(cleanPoll(["Call 0412 345 678", "Email me"])?.[0]).not.toMatch(/0412/);
    expect(cleanPoll("yes")).toBeNull();
  });

  it("needs a question and two choices", () => {
    expect(postProblem("", null, false, false, { asked: true, choices: ["A", "B"] })).toMatch(/question/);
    expect(postProblem("Which?", null, false, false, { asked: true, choices: null })).toMatch(/two/);
    expect(postProblem("Which?", null, false, false, { asked: true, choices: ["A", "B"] })).toBeNull();
  });

  it("shows the counts only once voted, to its writer, or once closed", () => {
    const at = "2026-11-15T10:00:00Z";
    expect(pollFor(["A", "B"], [3, 1], null, false, at, now).votes).toBeNull();
    expect(pollFor(["A", "B"], [3, 1], 0, false, at, now).votes).toEqual([3, 1]);
    expect(pollFor(["A", "B"], [3, 1], null, true, at, now).votes).toEqual([3, 1]);
    const closed = pollFor(["A", "B"], [3], null, false, "2026-11-01T10:00:00Z", now);
    expect(closed.open).toBe(false);
    expect(closed.votes).toEqual([3, 0]);
    expect(closed.total).toBe(3);
  });

  it("says how long it has", () => {
    expect(pollTimeWords("2026-11-15T10:00:00Z", now)).toBe("6 days left");
    expect(pollTimeWords("2026-11-09T11:00:00Z", now)).toBe("Closes today");
    expect(pollTimeWords("2026-11-01T10:00:00Z", now)).toBe("Closed");
    expect(pollShare(1, 3)).toBe(33);
    expect(pollShare(0, 0)).toBe(0);
  });
});

describe("most talked about", () => {
  const now = new Date("2026-11-16T10:00:00Z");
  const story = (id: string, likes: number, comments: number) =>
    ({
      id,
      headline: `Story ${id}`,
      publishedOn: null,
      foundAt: "2026-11-15T00:00:00Z",
      talk: { likes, liked: false, comments },
    }) as unknown as NewsItem;
  const post = (id: string, likes: number, comments: number, votes = 0, at = "2026-11-15T00:00:00Z") =>
    ({ id, at, text: `Post ${id}`, link: null, likes, comments, poll: votes ? { total: votes } : null }) as unknown as FeedPost;

  it("ranks by likes, comments twice and votes, from the last week, from three", () => {
    const entries = mergeFeed(
      [story("a", 1, 0), story("b", 2, 3)],
      [post("p", 0, 0, 6), post("q", 9, 9, 0, "2026-11-01T00:00:00Z"), post("r", 2, 1)],
    );
    expect(talkedAbout(entries, now).map((t) => t.id)).toEqual(["b", "p", "r"]);
  });

  it("says only what there is", () => {
    expect(talkWords({ likes: 1, comments: 0, votes: 4 })).toBe("1 like · 4 votes");
  });
});
