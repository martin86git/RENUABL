import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ADD_ON_MONTHLY_CENTS } from "@/lib/domain/design/add-ons";
import { SEAT_MONTHLY_CENTS, dollars } from "@/lib/domain/design/plans";
import { cleanContent, contentProblem } from "./edm";
import { claimsToCheck } from "./edm-sol";
import {
  PANEL_FIRST,
  PANEL_REST,
  GTM_EMAILS,
  GTM_PICTURES,
  MAX_WORDS,
  PRICE_DAY_LINE,
  SOL_TYPES,
  VOICE_MEET_LINE,
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
    expect(GTM_EMAILS).toHaveLength(15);
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
      expect(existsSync(join(process.cwd(), "marketing", "launch", GTM_PICTURES[key!].file))).toBe(true);
    }
  });

  it("say in words what Sol types in the pictures, kept in step with the picture tool", () => {
    const art = readFileSync(join(process.cwd(), "tools/marketing/launch-art.mjs"), "utf8");
    for (const words of Object.values(SOL_TYPES)) expect(art).toContain(JSON.stringify(words).slice(1, -1));
    expect(art).toContain(PRICE_DAY_LINE);
    expect(art).toContain(VOICE_MEET_LINE);
    // The drawn phone book uses only numbers from the range set aside for fiction.
    for (const n of art.match(/04dd ?d{3} ?d{3}/g) ?? []) expect(n).toMatch(/^0491 570 /);
    expect(art).not.toMatch(/henderson|shearer/i);
    // The logo is the website's own file, never RENUABL typed in another weight or spacing.
    expect(art).toContain("public/brand/renuabl-logo-white.png");
    expect(art).not.toMatch(/>RENUABL<\/(div|text)>/);
  });

  it("give every picture a hook above it and a button under it, show the designer but never first, and end on the Marketplace band", () => {
    for (const c of GTM_EMAILS) {
      expect(c.blocks[0].kind).toBe("bar");
      expect(c.blocks[1].kind).toBe("heading");
      const body = c.blocks.slice(1, -2).filter((b) => b.kind !== "spacer");
      // Each part: a heading, then at least one picture, then a button before the next heading.
      const parts: (typeof body)[] = [];
      for (const b of body) b.kind === "heading" ? parts.push([b]) : parts.at(-1)!.push(b);
      for (const p of parts) {
        expect(p.some((b) => b.kind === "image")).toBe(true);
        expect(p.at(-1)!.kind).toBe("button");
      }
      const keys = c.blocks.map(pictureKeyOf).filter(Boolean);
      expect(keys.some((k) => k === "dband" || k === "designer")).toBe(true);
      expect(["dband", "designer"]).not.toContain(keys[0]);
      expect(pictureKeyOf(c.blocks.at(-2)!)).toBe("footv");
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

  it("put each part on its own panel, apart from the next", () => {
    for (const c of GTM_EMAILS) {
      const heads = c.blocks.filter((b) => b.kind === "heading");
      expect(heads[0].fill).toBe(PANEL_FIRST);
      for (const h of heads.slice(1)) expect(h.fill).toBe(PANEL_REST);
      // Neighbouring blocks of one colour join one panel, so parts are kept apart by an unfilled spacer.
      c.blocks.forEach((b, i) => {
        const n = c.blocks[i + 1];
        if (n?.kind === "heading" && i > 1) expect(b.fill).toBeUndefined();
      });
    }
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

  it("offer a demo only as one to book: no demo account to try or open (27 Nov 2026, Martin)", () => {
    for (const c of GTM_EMAILS)
      for (const b of c.blocks) {
        expect(b.url ?? "").not.toContain("business/demo");
        expect(b.text ?? "").not.toMatch(/\b(try|open|start)\b.*\b(demo|designer|calendar)\b|in the demo|build yours/i);
      }
    expect(
      GTM_EMAILS.flatMap((c) => c.blocks).some((b) => b.url === "https://www.renuabl.com.au/?demo=1" && b.text === "Book a demo"),
    ).toBe(true);
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
