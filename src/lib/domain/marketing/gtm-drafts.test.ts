import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ADD_ON_MONTHLY_CENTS } from "@/lib/domain/design/add-ons";
import { SEAT_MONTHLY_CENTS, dollars } from "@/lib/domain/design/plans";
import { cleanContent, contentProblem } from "./edm";
import { claimsToCheck } from "./edm-sol";
import { GTM_EMAILS, GTM_PICTURES, gtmSequence, pictureKeyOf, withPictures } from "./gtm-drafts";
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
      const key = pictureKeyOf(c.blocks[0]);
      expect(key && GTM_PICTURES[key]).toBeTruthy();
      expect(existsSync(join(process.cwd(), "public", GTM_PICTURES[key!].file))).toBe(true);
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
