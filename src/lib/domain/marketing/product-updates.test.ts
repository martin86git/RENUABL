import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { Update } from "@/lib/domain/design/updates";
import { cleanContent, contentProblem, EDM_LIMITS } from "./edm";
import { claimsToCheck } from "./edm-sol";
import { pictureKeyOf, withPictures } from "./gtm-drafts";
import {
  UPDATES_ALSO,
  UPDATES_EMAIL_LINE,
  UPDATES_EMAIL_NAME,
  UPDATES_HIGHLIGHTS,
  UPDATES_NEEDS,
  UPDATES_PICTURES,
  alsoNew,
  byRule,
  cleanUpdatesAnswer,
  daysBefore,
  updatesAsk,
  updatesBrief,
  updatesCampaignName,
  updatesEmail,
  updatesWeek,
  withoutEmptyPictures,
} from "./product-updates";

const LIST: Update[] = [
  { day: "2026-11-27", area: "Calls", words: "The note-taker types up both sides of a call." },
  { day: "2026-11-26", area: "Settings", words: "Connect Xero: signed proposals raise the invoice." },
  { day: "2026-11-25", area: "Sol", words: "Sol's chat is a soft mist blue." },
  { day: "2026-11-24", area: "Calls", words: "Test calls work while your number is set up." },
  { day: "2026-11-21", area: "Designer", words: "The quote builder shows a cost each." },
  { day: "2026-11-20", area: "CRM", words: "Older than the week." },
];
const week = updatesWeek("2026-11-27", LIST);
const ids = Object.fromEntries(Object.keys(UPDATES_NEEDS).map((k, i) => [k, `mimg_${String(i).padStart(24, "0")}`]));

describe("the week", () => {
  it("is the seven days ending today", () => {
    expect(daysBefore("2026-12-02", 6)).toBe("2026-11-26");
    expect(week.from).toBe("2026-11-21");
    expect(week.updates).toHaveLength(5);
    expect(updatesCampaignName(week)).toBe("Launch Day · week to 27 Nov 2026");
  });

  it("has no email when nothing shipped", () => {
    expect(updatesEmail(updatesWeek("2026-10-01", LIST))).toBeNull();
  });
});

describe("the email by rule", () => {
  const c = withPictures(updatesEmail(week)!, ids);

  it("is a whole, valid email once its pictures are in", () => {
    expect(contentProblem(c)).toBeNull();
    expect(cleanContent(c)).toEqual(c);
    expect(c.blocks.length).toBeLessThanOrEqual(EDM_LIMITS.blocks);
  });

  it("opens on the masthead, whose file is in the site, and ends on the two bands", () => {
    expect(pictureKeyOf(c.blocks[0])).toBe("launchday");
    expect(existsSync(join(process.cwd(), "marketing", "launch", UPDATES_PICTURES.launchday.file))).toBe(true);
    expect(pictureKeyOf(c.blocks.at(-2)!)).toBe("footv");
    expect(pictureKeyOf(c.blocks.at(-1)!)).toBe("footer");
  });

  it("leads with one change an area and lists every other change of the week", () => {
    const w = byRule(week);
    expect(w.highlights.map((h) => week.updates[h.index].area)).toEqual(["Calls", "Settings", "Sol", "Designer"]);
    const also = alsoNew(
      week,
      w.highlights.map((h) => h.index),
    );
    expect(also).toBe("Calls: Test calls work while your number is set up.");
    const all = c.blocks.map((b) => b.text).join("\n");
    for (const u of week.updates) expect(all).toContain(u.words);
    expect(all).not.toContain("Older than the week.");
  });

  it("drops a picture that couldn't be made", () => {
    const bare = withoutEmptyPictures(updatesEmail(week)!);
    expect(bare.blocks.some((b) => b.kind === "image")).toBe(false);
    expect(contentProblem(bare)).toBeNull();
  });

  it("makes no claim that needs proof and links only to renuabl.com.au", () => {
    expect(claimsToCheck([c.subject, c.preview, ...c.blocks.map((b) => b.text)].join(" "))).toEqual([]);
    for (const b of c.blocks) if (b.url) expect(b.url).toMatch(/^https:\/\/www\.renuabl\.com\.au(\/|$)/);
  });
});

describe("Sol's write-up", () => {
  it("numbers the week's changes in his brief and asks for honest excitement", () => {
    expect(updatesBrief(week)).toContain("2. [Settings] Connect Xero");
    expect(updatesAsk(week)).toMatch(/exclamation marks \(none at all\)/);
    expect(updatesAsk(week)).toContain("Every fact must be in the brief");
  });

  it("keeps only highlights that are one of the week's changes, each once, and takes the shouting out", () => {
    const w = cleanUpdatesAnswer(
      {
        subject: "Xero, connected!",
        preview: "And your calls write themselves up",
        hook: "Your books now keep themselves!!",
        intro: "Hi {firstName},\n\nBig week. {lastName}",
        highlights: [
          { update: 2, heading: "Signed means invoiced", text: "Connect Xero and a signed proposal raises its invoice." },
          { update: 2, heading: "Again", text: "The same one." },
          { update: 9, heading: "Made up", text: "Not on the list." },
          { update: 1, heading: "Calls that write themselves up", text: "Both sides, typed as you talk!" },
        ],
      },
      week,
    )!;
    expect(w.subject).toBe("Xero, connected.");
    expect(w.hook).toBe("Your books now keep themselves.");
    expect(w.intro).toBe("Hi {firstName},\n\nBig week. ");
    expect(w.highlights.map((h) => h.index)).toEqual([1, 0]);
    expect(w.highlights[1].text).toBe("Both sides, typed as you talk.");
    const c = updatesEmail(week, w)!;
    expect(c.blocks.find((b) => b.id === "updalsot")!.text).toContain("Sol: Sol's chat is a soft mist blue.");
    expect(c.blocks.find((b) => b.id === "updalsot")!.text).not.toContain("Connect Xero");
  });

  it("is nothing with no usable highlight", () => {
    expect(cleanUpdatesAnswer({ highlights: [{ update: 40, heading: "x", text: "y" }] }, week)).toBeNull();
    expect(cleanUpdatesAnswer(null, week)).toBeNull();
  });

  it("caps what it leads with and what it lists", () => {
    const many = updatesWeek(
      "2026-11-27",
      Array.from({ length: 20 }, (_, i) => ({ day: "2026-11-27", area: `Area ${i}`, words: `Change ${i}.` })),
    );
    const c = updatesEmail(many)!;
    expect(byRule(many).highlights).toHaveLength(UPDATES_HIGHLIGHTS);
    expect(c.blocks.find((b) => b.id === "updalsot")!.text).toContain(
      `And ${20 - UPDATES_HIGHLIGHTS - UPDATES_ALSO} more on the Updates page.`,
    );
    expect(c.blocks.length).toBeLessThanOrEqual(EDM_LIMITS.blocks);
  });
});

describe("the masthead", () => {
  it("says the email's name and line, in step with the picture tool", () => {
    const art = readFileSync(join(process.cwd(), "tools/marketing/launch-art.mjs"), "utf8");
    expect(art).toContain(`<b>${UPDATES_EMAIL_NAME}</b>`);
    expect(art).toContain(`<em>${UPDATES_EMAIL_LINE}</em>`);
  });
});
