import { existsSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { COMING_SOON, JOURNEY, MARKETPLACE, OLD_WAY, SALES_HERO, SOL, salesCopy } from "./sales-page";

describe("the sign-up page for solar businesses", () => {
  it("makes no claim the product can't prove", () => {
    for (const line of salesCopy()) expect(line).not.toMatch(/\b(best|leading|first|#1|number one|guaranteed?|exact|precise|unlimited)\b/i);
  });

  it("names no other product, and compares prices only with where and when they were read", () => {
    for (const line of [...salesCopy(), OLD_WAY.source]) expect(line).not.toMatch(/pylon|opensolar|solargraf|aurora|arka/i);
    expect(OLD_WAY.source).toMatch(/published pricing, read on \d{1,2} \w+ 20\d\d/);
  });

  it("takes its prices from the plans", () => {
    expect(SALES_HERO.small[0]).toBe("$29 a user a month, inc GST");
    expect(OLD_WAY.rows.find((r) => r.what === "A design job")?.us).toBe("$3");
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
    ].filter((v) => v.kind === "shot");
    for (const v of shots) if (v.kind === "shot") expect(existsSync(`public${v.src}`), v.src).toBe(true);
  });
});
