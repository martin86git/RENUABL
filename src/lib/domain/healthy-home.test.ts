import { describe, expect, it } from "vitest";
import { HOME_HERO, healthyHomeText } from "./healthy-home";
import { HEALTH_ITEMS, HEALTH_QUESTIONS, cleanAnswers, healthPlan, shareableAnswers } from "./home-health";
import { WHOOP_COPY, WHOOP_OFFER, nextWhoopStatus, whoopEligible, whoopOfferOpen } from "./whoop-offer";

const BANNED = /\b(cure|treat|prevent|guaranteed?|best|first ever|leading|AI|installer)\b|\$\d/i;

describe("Healthy Home copy", () => {
  it('has exactly one "sun" in the headline (the home page highlights it)', () => {
    expect(HOME_HERO.headline.split("sun")).toHaveLength(2);
  });

  it("prices nothing and claims no health outcomes", () => {
    expect(healthyHomeText()).not.toMatch(BANNED);
  });
});

describe("WHOOP offer", () => {
  it("is for orders with a battery", () => {
    expect(whoopEligible({ batteryKwh: 16 })).toBe(true);
    expect(whoopEligible({ batteryKwh: 0 })).toBe(false);
  });

  it("closes at the cap", () => {
    expect(whoopOfferOpen(WHOOP_OFFER.cap - 1)).toBe(true);
    expect(whoopOfferOpen(WHOOP_OFFER.cap)).toBe(false);
  });

  it("only moves forward, and only an unshipped claim can be released", () => {
    expect(nextWhoopStatus("claimed", "shipped")).toBe(true);
    expect(nextWhoopStatus("shipped", "delivered")).toBe(true);
    expect(nextWhoopStatus("claimed", "delivered")).toBe(false);
    expect(nextWhoopStatus("claimed", "released")).toBe(true);
    expect(nextWhoopStatus("shipped", "released")).toBe(false);
    expect(nextWhoopStatus("released", "claimed")).toBe(false);
  });

  it("states the value and the cap from one place", () => {
    expect(WHOOP_COPY.strip).toContain(`$${WHOOP_OFFER.value}`);
    expect(WHOOP_COPY.first).toContain(String(WHOOP_OFFER.cap));
  });
});

describe("Home Health check", () => {
  it("has the brief's 23 questions, all optional choices", () => {
    expect(HEALTH_QUESTIONS).toHaveLength(23);
    for (const q of HEALTH_QUESTIONS) expect(q.options.length).toBeGreaterThanOrEqual(2);
  });

  it("recommends induction and a rangehood free fix for gas cooking", () => {
    const plan = healthPlan({ "gas-cooking": "yes" });
    expect(plan.recommendations[0].item).toBe("induction");
    expect(plan.freeFixes.map((f) => f.title)).toContain("Use the rangehood every time you cook");
  });

  it("shows at most three recommendations and always a free fix", () => {
    const plan = healthPlan({
      "gas-cooking": "yes",
      stuffy: "often",
      mould: "yes",
      "drinking-filter": "no",
      leak: "yes",
    });
    expect(plan.recommendations).toHaveLength(3);
    expect(healthPlan({}).freeFixes.length).toBeGreaterThan(0);
    expect(healthPlan({}).recommendations).toHaveLength(0);
  });

  it("follows the brief's rules", () => {
    expect(healthPlan({ purifier: "no", allergies: "yes" }).recommendations[0].item).toBe("purifiers");
    expect(healthPlan({ purifier: "no" }).recommendations).toHaveLength(0);
    expect(healthPlan({ "ac-filter": "don-t-know" }).freeFixes[0].title).toMatch(/AC filter/);
    expect(healthPlan({ "shower-filter": "no" }).recommendations[0].item).toBe("whole-house-filter");
    expect(healthPlan({ "bedroom-temp": "too-hot", "ac-overnight": "often" }).recommendations[0].item).toBe("smart-ac");
    expect(healthPlan({ "light-in": "yes" }).recommendations[0].item).toBe("blinds");
    expect(healthPlan({ "gentle-light": "maybe" }).recommendations[0].item).toBe("circadian");
    expect(healthPlan({ stay: "10-years" }).longTerm).toBe(true);
  });

  it("keeps only known answers, and allergies only with consent", () => {
    const raw = { "gas-cooking": "yes", allergies: "yes", rooms: ["kitchen", "nope"], bogus: "x", stuffy: "maybe" };
    expect(cleanAnswers(raw, false)).toEqual({ "gas-cooking": "yes", rooms: ["kitchen"] });
    expect(cleanAnswers(raw, true)).toMatchObject({ allergies: "yes" });
    expect(shareableAnswers({ allergies: "yes", leak: "no" })).toEqual({ leak: "no" });
  });

  it("never makes health claims in recommendations", () => {
    const all = healthPlan({
      "gas-cooking": "yes",
      stuffy: "often",
      mould: "yes",
      purifier: "no",
      allergies: "yes",
      "ac-filter": "longer-ago",
      "drinking-filter": "no",
      "shower-filter": "no",
      leak: "yes",
      "bedroom-temp": "too-hot",
      "ac-overnight": "often",
      "light-in": "yes",
      "gentle-light": "yes",
      screens: "yes",
    });
    const text = JSON.stringify(all) + Object.values(HEALTH_ITEMS).join(" ");
    expect(text).not.toMatch(BANNED);
  });
});
