import { describe, expect, it } from "vitest";
import { cleanContent, contentProblem } from "./edm";
import { claimsToCheck } from "./edm-sol";
import { GTM_EMAILS, gtmSequence } from "./gtm-drafts";
import { cleanSequence, sequenceProblem } from "./sequences";

const allText = (c: (typeof GTM_EMAILS)[number]) => [c.subject, c.preview, ...c.blocks.map((b) => b.text)].join(" ");

describe("the go-to-market drafts", () => {
  it("are whole, valid emails that come through the cleaner unchanged", () => {
    for (const c of GTM_EMAILS) {
      expect(contentProblem(c)).toBeNull();
      expect(cleanContent(c)).toEqual(c);
    }
  });

  it("make no claim that needs proof, name no rival and use only our fields", () => {
    for (const c of GTM_EMAILS) {
      const t = allText(c);
      expect(claimsToCheck(t)).toEqual([]);
      expect(t.match(/\{[A-Za-z]+\}/g)?.every((f) => f === "{firstName}" || f === "{company}") ?? true).toBe(true);
      expect(t).not.toMatch(/save \d|%|was \$|discount|off\b/i);
    }
  });

  it("link only to renuabl.com.au/business, and price as the page does", () => {
    for (const c of GTM_EMAILS) for (const b of c.blocks) if (b.url) expect(b.url).toMatch(/^https:\/\/www\.renuabl\.com\.au\/business/);
    const words = GTM_EMAILS.map(allText).join(" ");
    expect(words).toContain("$49 a user a month");
    expect(words).toContain("$39 a user a month");
    expect(words).toContain("first month is free");
    expect(words).not.toContain("$0");
  });

  it("is a valid sequence of four emails, started by opening the launch, ended by signing up", () => {
    const s = gtmSequence("mca_0123456789abcdef");
    expect(sequenceProblem(s)).toBeNull();
    expect(cleanSequence(s)).toEqual(s);
    expect(s.steps.filter((x) => x.kind === "email")).toHaveLength(4);
    expect(s.trigger).toEqual({ kind: "opened", campaignId: "mca_0123456789abcdef" });
  });
});
