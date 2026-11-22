import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ADD_ON_MONTHLY_CENTS } from "@/lib/domain/design/add-ons";
import { SEAT_MONTHLY_CENTS, dollars } from "@/lib/domain/design/plans";
import { cleanContent, contentProblem } from "./edm";
import { claimsToCheck } from "./edm-sol";
import {
  GTM_EMAILS,
  GTM_PICTURES,
  MAX_WORDS,
  PRICE_DAY_LINE,
  SOL_TYPES,
  voiceAday,
  gtmSequence,
  pictureKeyOf,
  withPictures,
} from "./gtm-drafts";
import { cleanSequence, sequenceProblem } from "./sequences";

const allText = (c: (typeof GTM_EMAILS)[number]) => [c.subject, c.preview, ...c.blocks.map((b) => b.text)].join(" ");
const ids = Object.fromEntries(Object.keys(GTM_PICTURES).map((k, i) => [k, `mimg_${String(i).padStart(24, "0")}`]));

describe("the launch drafts", () => {
  it("are whole, valid emails once their pictures are in, and come through the cleaner unchanged", () => {
    expect(GTM_EMAILS).toHaveLength(7);
    for (const raw of GTM_EMAILS) {
      const c = withPictures(raw, ids);
      expect(contentProblem(c)).toBeNull();
      expect(cleanContent(c)).toEqual(c);
    }
  });

  it("open each email with a picture whose file is in the site", () => {
    for (const c of GTM_EMAILS) {
      const first = c.blocks.find((b) => b.kind === "image")!;
      const key = pictureKeyOf(first);
      expect(key && GTM_PICTURES[key]).toBeTruthy();
      expect(existsSync(join(process.cwd(), "public", GTM_PICTURES[key!].file))).toBe(true);
    }
  });

  it("say in words what Sol types in the pictures, kept in step with the picture tool", () => {
    const art = readFileSync(join(process.cwd(), "tools/marketing/launch-art.mjs"), "utf8");
    for (const words of Object.values(SOL_TYPES)) expect(art).toContain(JSON.stringify(words).slice(1, -1));
    expect(art).toContain(PRICE_DAY_LINE);
  });

  it("open on the hook and end on the Marketplace band", () => {
    for (const c of GTM_EMAILS) {
      expect(c.blocks[0].kind).toBe("heading");
      expect(pictureKeyOf(c.blocks.at(-1)!)).toBe("footer");
      expect(c.blocks.at(-1)!.url).toBe("https://www.renuabl.com.au/design/marketplace");
    }
  });

  it("puts Calls & Texts at less than $2 a day, in every month", () => {
    expect(voiceAday()).toBeLessThan(2);
    expect(voiceAday(4900)).toBeCloseTo(1.61, 2);
    expect(4900 / 100 / 28).toBeLessThan(2);
    expect(PRICE_DAY_LINE).toBe("$49 a month is $1.61 a day.");
  });

  it("are short: a glance, not a read", () => {
    for (const c of GTM_EMAILS) {
      const words = c.blocks
        .filter((b) => b.kind === "text")
        .map((b) => b.text)
        .join(" ")
        .split(/\s+/)
        .filter(Boolean);
      expect(words.length).toBeLessThanOrEqual(MAX_WORDS);
    }
  });

  it("make no claim that needs proof, name no rival and use only our fields", () => {
    for (const c of GTM_EMAILS) {
      const t = allText(c);
      expect(claimsToCheck(t)).toEqual([]);
      expect(t.match(/\{[A-Za-z]+\}/g)?.every((f) => f === "{firstName}" || f === "{company}") ?? true).toBe(true);
      expect(t).not.toMatch(/save \d|%|was \$|discount|\boff\b|guarantee/i);
    }
  });

  it("say the voice agents are automated, link only to renuabl.com.au, and price as the plans do", () => {
    for (const c of GTM_EMAILS) for (const b of c.blocks) if (b.url) expect(b.url).toMatch(/^https:\/\/www\.renuabl\.com\.au(\/|$)/);
    const words = GTM_EMAILS.map(allText).join(" ");
    expect(words).toContain("automated assistant");
    expect(words).toContain(`${dollars(SEAT_MONTHLY_CENTS)} a user a month`);
    expect(words).toContain(`${dollars(ADD_ON_MONTHLY_CENTS.voice ?? 0)} a month`);
  });

  it("is a valid series of six emails with their pictures, started by opening the launch, ended by signing up", () => {
    const s = gtmSequence("mca_0123456789abcdef", ids);
    expect(sequenceProblem(s)).toBeNull();
    expect(cleanSequence(s)).toEqual(s);
    expect(s.steps.filter((x) => x.kind === "email")).toHaveLength(6);
    expect(s.trigger).toEqual({ kind: "opened", campaignId: "mca_0123456789abcdef" });
    expect(s.stops.signedUp).toBe(true);
  });
});
