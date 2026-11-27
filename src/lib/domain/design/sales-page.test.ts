import { existsSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  COMING_SOON,
  CRM_SHOT,
  DEMO_REQUEST,
  HERO_LIVE,
  JOURNEY,
  LAUNCH,
  MARKETPLACE,
  PRICING,
  SALES_HERO,
  SERVICE_SHOT,
  SOL,
  VOICE_INTRO,
  salesCopy,
} from "./sales-page";

describe("the sign-up page for solar businesses", () => {
  it("offers a demo only as one to book: nobody opens a demo account themselves (27 Nov 2026, Martin)", () => {
    for (const label of [SALES_HERO.demo, VOICE_INTRO.demo, LAUNCH.cta, DEMO_REQUEST.title]) expect(label).toBe("Book a demo");
    const said = [...salesCopy(), HERO_LIVE.ask.fallback, ...HERO_LIVE.ask.questions.map((q) => q.answer)].join(" ");
    expect(said).not.toMatch(/start demo|try the demo|press .*demo and you're in/i);
    expect(DEMO_REQUEST.consent).toMatch(/get in touch about RENUABL/);
  });

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
    expect(PRICING.plans.map((p) => p.price)).toEqual(["$49", "$39"]);
    expect(PRICING.firstMonth).toBe("Your first month is free, on either plan, with 6 free sites in the designer. Prices include GST.");
    expect(PRICING.addOns.map((a) => [a.name, a.price])).toEqual([
      ["Calls & Texts", "$49 a month for your business, including GST"],
      ["Growth", "$19 a month for your business, including GST"],
    ]);
    expect(PRICING.headline).toBe("From $39 a user. Then pay as you go.");
    expect(PRICING.team.map((t) => [t.title, t.price, t.per])).toEqual([
      ["Your AI voice sales team", "$49", "a month for your business"],
      ["Your AI right hand", "50", "credits a user a month, included"],
      ["Your design studio", "$3", "a site"],
      ["Your marketing department", "$19", "a month for your business"],
      ["Your checkout", "2.5%", "a payment"],
    ]);
  });

  it("never calls a monthly add-on pay as you go, or the whole page all-inclusive", () => {
    for (const t of PRICING.team) if (t.per.includes("a month for your business")) expect(t.how).not.toMatch(/pay as you go/i);
    for (const line of salesCopy()) expect(line).not.toMatch(/every feature/i);
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
