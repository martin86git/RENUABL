import { describe, expect, it } from "vitest";
import {
  RESULTS_MIN,
  SOL_POLLS,
  cleanFollowWord,
  cleanMemberKind,
  cleanPostKind,
  cleanSolAnswer,
  cleanWin,
  digestAddress,
  digestEmail,
  digestPost,
  digestStories,
  holdsWord,
  noteHref,
  noteWords,
  postFollowed,
  readAnswerJson,
  resultsPost,
  solPollFor,
  storyFollowed,
  weekOf,
  winHeadline,
  winSystemWords,
} from "./feed-social";

describe("post kinds", () => {
  it("keeps a known kind, else a plain post", () => {
    expect(cleanPostKind("question")).toBe("question");
    expect(cleanPostKind("nonsense")).toBe("post");
    expect(cleanPostKind(3)).toBe("post");
  });
  it("never lets a member post as Sol", () => {
    expect(cleanMemberKind("win")).toBe("win");
    expect(cleanMemberKind("sol-poll")).toBe("post");
    expect(cleanMemberKind("sol-results")).toBe("post");
  });
});

describe("Sol's answer to a question", () => {
  const site = (u: string) => new URL(u).hostname.replace(/^www\./, "");
  it("keeps only sources his search showed, at most four", () => {
    const a = cleanSolAnswer(
      {
        answer: "Check the firmware notes on the maker's page first. Most report the update fixed it.",
        sources: ["https://www.maker.com.au/notes", "https://made-up.example/page", "http://maker.com.au/notes"],
      },
      ["https://maker.com.au/notes/"],
      site,
    );
    expect(a?.sources).toEqual([{ url: "https://www.maker.com.au/notes", site: "maker.com.au" }]);
  });
  it("gives no answer when there are too few words", () => {
    expect(cleanSolAnswer({ answer: "Yes." }, [], site)).toBeNull();
    expect(cleanSolAnswer(null, [], site)).toBeNull();
  });
  it("cuts a long answer at a whole sentence", () => {
    const long = `${"This is a sentence about inverters. ".repeat(80)}`;
    const a = cleanSolAnswer({ answer: long, sources: [] }, [], site);
    expect(a!.text.length).toBeLessThanOrEqual(1500);
    expect(a!.text.endsWith(".")).toBe(true);
  });
  it("reads the JSON in his reply", () => {
    expect(readAnswerJson('Here: {"answer": "x", "sources": []} done')).toEqual({ answer: "x", sources: [] });
    expect(readAnswerJson("no json")).toBeNull();
  });
});

describe("wins", () => {
  const win = cleanWin({
    kw: 8.2,
    panels: 18,
    batteryKwh: 13.5,
    ev: true,
    suburb: "Glen Waverley",
    state: "vic",
    address: "8 Example Court",
  })!;
  it("keeps sizes and the suburb, never an address", () => {
    expect(win).toEqual({ kw: 8.2, panels: 18, batteryKwh: 13.5, ev: true, suburb: "Glen Waverley", state: "VIC" });
  });
  it("reads as a headline", () => {
    expect(winHeadline(win)).toBe("Installed: 8.20 kW solar with a 13.5 kWh battery and an EV charger in Glen Waverley, VIC");
    expect(winSystemWords({ kw: null, panels: null, batteryKwh: 10, ev: false })).toBe("A 10 kWh battery");
    expect(winSystemWords({ kw: null, panels: null, batteryKwh: null, ev: false })).toBe("A solar install");
  });
});

describe("Sol's weekly poll", () => {
  it("keys a week by its Monday in Melbourne", () => {
    // Sunday 8pm UTC is Monday 7am in Melbourne (daylight time).
    expect(weekOf(new Date("2026-11-22T20:00:00Z"))).toBe("2026-11-23");
    expect(weekOf(new Date("2026-11-22T10:00:00Z"))).toBe("2026-11-16");
  });
  it("asks a different question each week, in turn", () => {
    const a = solPollFor("2026-11-16");
    const b = solPollFor("2026-11-23");
    expect(a.question).not.toBe(b.question);
    expect(SOL_POLLS.every((p) => p.choices.length >= 2 && p.choices.length <= 4)).toBe(true);
  });
  it("posts results only when enough voted, naming no business", () => {
    expect(resultsPost("Q?", ["A", "B"], [2, 1])).toBeNull();
    const r = resultsPost("How far ahead?", ["Under 2 weeks", "Over"], [6, 2])!;
    expect(r.results.total).toBe(8);
    expect(r.text).toContain('75% said "Under 2 weeks"');
    expect(r.text).toContain("no business is named");
    expect(resultsPost("Q?", ["A", "B"], [3, 3])!.text).toContain("drew level");
    expect(RESULTS_MIN).toBeGreaterThanOrEqual(5);
  });
});

describe("notifications", () => {
  it("says what happened", () => {
    expect(noteWords({ kind: "like", by: "Sam · Sunrise Solar", count: 1, storyId: null })).toBe("Sam · Sunrise Solar liked your post");
    expect(noteWords({ kind: "comment", by: "Jo", count: 3, storyId: null })).toBe("Jo and 2 others commented on your post");
    expect(noteWords({ kind: "reply", by: "Jo", count: 2, storyId: "story_1" })).toBe(
      "Jo and 1 other also commented on a story you commented on",
    );
    expect(noteWords({ kind: "answered", by: "Sol", count: 1, storyId: null })).toBe("Sol answered your question");
  });
  it("links to the post on the News page", () => {
    expect(noteHref({ postId: "post_1", storyId: null })).toBe("/design/news#feed-post_1");
  });
});

describe("following", () => {
  it("cleans a word to follow", () => {
    expect(cleanFollowWord("  Tesla!! ")).toBe("Tesla");
    expect(cleanFollowWord("x")).toBeNull();
    expect(cleanFollowWord(5)).toBeNull();
  });
  it("matches whole words in any case", () => {
    expect(holdsWord("New TESLA Powerwall 3 lands", "tesla")).toBe(true);
    expect(holdsWord("Teslarati says", "tesla")).toBe(false);
    expect(holdsWord("the solar edge of it", "solar edge")).toBe(true);
  });
  it("puts stories and posts under Following", () => {
    expect(storyFollowed({ headline: "Robotaxis in Sydney", summary: "Tesla's plan", brands: [] }, ["tesla"])).toBe("tesla");
    expect(storyFollowed({ headline: "Rates hold", summary: "", brands: [] }, ["tesla"])).toBeNull();
    const f = { words: ["sigenergy"], businesses: [{ key: "k1", name: "Sparks" }] };
    expect(postFollowed({ text: "hi", businessKey: "k1", link: null }, f)).toBe("business");
    expect(postFollowed({ text: "Our Sigenergy installs", businessKey: "k2", link: null }, f)).toBe("sigenergy");
    expect(postFollowed({ text: "hi", businessKey: null, link: null }, f)).toBeNull();
  });
});

describe("the Monday digest", () => {
  const now = new Date("2026-11-23T20:00:00Z");
  const story = (id: string, likes: number, comments: number, daysAgo: number) => ({
    id,
    headline: `Story ${id}`,
    site: "abc.net.au",
    url: `https://abc.net.au/${id}`,
    likes,
    comments,
    foundAt: new Date(now.getTime() - daysAgo * 86_400_000).toISOString(),
  });
  it("takes the week's five most talked about stories, then the newest", () => {
    const top = digestStories(
      [
        story("a", 0, 0, 1),
        story("b", 1, 2, 2),
        story("c", 0, 0, 9),
        story("d", 5, 0, 3),
        story("e", 0, 0, 0.5),
        story("f", 0, 0, 4),
        story("g", 0, 0, 5),
      ],
      now,
    );
    expect(top.map((s) => s.id)).toEqual(["b", "d", "e", "a", "f"]);
  });
  it("picks a post only when something was said or liked", () => {
    expect(digestPost([{ id: "p", author: "Jo", text: "x", likes: 0, comments: 0, votes: 0 }])).toBeNull();
    expect(digestPost([{ id: "p", author: "Jo", text: "x", likes: 1, comments: 0, votes: 0 }])?.id).toBe("p");
  });
  it("writes an email with a way to turn it off, and none when there's nothing", () => {
    const e = digestEmail({
      firstName: "Sam",
      stories: [story("a", 0, 0, 1)],
      post: null,
      link: "https://www.renuabl.com.au/design/news",
    })!;
    expect(e.subject).toBe("This week in solar: Story a");
    expect(e.text).toContain("Hi Sam,");
    expect(e.text).toContain("Turn the Monday email off");
    expect(e.html).not.toContain("<script");
    expect(digestEmail({ firstName: null, stories: [], post: null, link: "x" })).toBeNull();
  });
  it("never goes to a made-up or demo business", () => {
    expect(digestAddress("sam@sunrise.com.au")).toBe(true);
    expect(digestAddress("owner@renuabl-staff.example")).toBe(false);
    expect(digestAddress("demo-ab12@demo.renuabl.example")).toBe(false);
  });
});
