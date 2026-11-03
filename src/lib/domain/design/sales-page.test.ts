import { existsSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { COMING_SOON, JOURNEY, MARKETPLACE, PRICING, SERVICE_SHOT, SOL, CRM_SHOT, salesCopy } from "./sales-page";

describe("the sign-up page for solar businesses", () => {
  it("makes no claim the product can't prove", () => {
    // "Your first month" is the offer, a plain fact, not a claim to be first at anything.
    for (const line of salesCopy())
      expect(line.replace(/\bfirst month\b/gi, "")).not.toMatch(
        /\b(best|leading|first|#1|number one|guaranteed?|exact|precise|unlimited)\b/i,
      );
  });

  it("names no other product", () => {
    for (const line of salesCopy()) expect(line).not.toMatch(/pylon|opensolar|solargraf|aurora|arka|tradify|fergus/i);
  });

  it("takes its prices from the plans", () => {
    expect(PRICING.plans.map((p) => p.price)).toEqual(["$99", "$69"]);
    expect(PRICING.firstMonth).toBe("Your first month is $29 a user, on either plan. Prices include GST.");
  });

  it("never crosses a price out or calls it a discount", () => {
    for (const line of salesCopy()) expect(line).not.toMatch(/\b(discount|save \d|was \$|\d+% off)\b/i);
  });

  it("labels what isn't in the product yet", () => {
    expect(COMING_SOON.length).toBeGreaterThan(0);
    expect(MARKETPLACE.eyebrow).toContain("Coming soon");
  });

  it("shows only screenshots that exist", () => {
    const shots = [
      ...JOURNEY.map((j) => j.visual),
      { kind: "shot" as const, src: SOL.shot.src, alt: SOL.shot.alt },
      { kind: "shot" as const, src: SOL.example.shot.src, alt: SOL.example.shot.alt },
      { kind: "shot" as const, src: SERVICE_SHOT.src, alt: SERVICE_SHOT.alt },
      { kind: "shot" as const, src: CRM_SHOT.src, alt: CRM_SHOT.alt },
    ].filter((v) => v.kind === "shot");
    for (const v of shots) if (v.kind === "shot") expect(existsSync(`public${v.src}`), v.src).toBe(true);
  });
});
