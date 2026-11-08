import { describe, expect, it } from "vitest";
import { BACKUP_LINE, BATTERY_STAGES, batteryHero, heroGlow, heroWords, shareOfDay } from "./battery-hero";
import { COST_WORDS, buildProposal, type ProposalOption, type ProposalView } from "./proposal";
import { sampleInputs } from "./proposal-fixture";

const built = (withBattery: boolean) => {
  const result = buildProposal(sampleInputs({ withBattery }));
  if (!result.ok) throw new Error(result.problems.join(" "));
  return result;
};

/** A view with its system changed: battery only, solar only, and so on. */
const withSystem = (view: ProposalView, system: Partial<ProposalView["system"]>, panels?: number[][]): ProposalView => ({
  ...view,
  system: { ...view.system, ...system },
  roof: { ...view.roof, panels: panels ?? view.roof.panels },
});

describe("the battery hero", () => {
  it("is left out with no battery: a solar only proposal is as it was", () => {
    const { view } = built(false);
    expect(view.system.batteryKwh).toBe(0);
    expect(batteryHero(view, { roofShown: true })).toBeNull();
  });

  it("lays the battery over the roof for solar and a battery", () => {
    const { view } = built(true);
    const hero = batteryHero(view, { roofShown: true });
    expect(hero?.kind).toBe("roof");
    expect(hero?.kwh).toBe(view.system.batteryKwh);
    expect(hero?.headline).toBe("And your evenings");
    expect(hero?.says[0]).toBe(`Holds up to ${view.system.batteryKwh} kWh for your evenings.`);
    expect(hero?.stages).toEqual(BATTERY_STAGES);
  });

  it("draws the home's day when the roof isn't shown, or there is no solar on the design", () => {
    const { view } = built(true);
    expect(batteryHero(view, { roofShown: false })?.kind).toBe("day");
    const batteryOnly = withSystem(view, { kw: 0, panels: 0 }, []);
    const hero = batteryHero(batteryOnly, { roofShown: true });
    expect(hero?.kind).toBe("day");
    expect(hero?.headline).toBe(`Your home's day, with a ${view.system.batteryKwh} kWh battery.`);
  });

  it("says blackout backup only when the battery chosen keeps circuits on", () => {
    const { view } = built(true);
    expect(batteryHero(view, { roofShown: true })?.says).not.toContain(BACKUP_LINE);
    const option = (goal: ProposalOption["goal"], backup: boolean, recommended: boolean): ProposalOption => ({
      goal,
      name: goal,
      promise: "",
      recommended,
      backup,
      system: view.system,
      roofPanels: view.roof.panels,
      price: view.price,
      production: view.production,
      bill: view.bill,
      paybackYears: view.paybackYears,
      deposit: null,
      milestones: [],
    });
    const offered = { ...view, options: [option("return", false, true), option("independence", true, false)] };
    expect(batteryHero(offered, { roofShown: true })?.backup).toBe(false);
    expect(batteryHero(offered, { roofShown: true, chosen: "independence" })?.says).toContain(BACKUP_LINE);
  });

  it("sets the battery against a day's use as an estimate, rounded down", () => {
    expect(shareOfDay(10, 16)).toBe("That's about 60% of a day's use in your home (estimate).");
    expect(shareOfDay(16, 16)).toBe("That's about a full day of your home's use (estimate).");
    expect(shareOfDay(13.5, 20)).toBe("That's about 60% of a day's use in your home (estimate).");
    expect(shareOfDay(0.5, 20)).toBeNull();
    expect(shareOfDay(10, 0)).toBeNull();
    expect(shareOfDay(10, undefined)).toBeNull();
  });

  it("never puts a cost, a margin, a product code or the business's figures in front of the customer", () => {
    const { view, internal } = built(true);
    for (const roofShown of [true, false]) {
      const hero = batteryHero(view, { roofShown, chosen: null });
      if (!hero) throw new Error("no hero");
      const words = heroWords(hero).toLowerCase();
      for (const word of COST_WORDS) expect(words).not.toContain(word.toLowerCase());
      for (const code of ["JKM475N-48QL6-DB", "SGWSG5.0RS", "SIG11130001"]) expect(words).not.toContain(code.toLowerCase());
      for (const secret of [internal.cost, internal.margin, internal.priceExGst]) expect(words).not.toContain(String(secret));
      // No promise words either.
      for (const word of ["guarantee", "exact", "precise", "25 year", "25-year"]) expect(words).not.toContain(word);
    }
  });
});

describe("the charge's colour over the dark", () => {
  it("keeps a bright brand colour and gives way to white for a dark one", () => {
    expect(heroGlow("#FF5A1F")).toBe("#FF5A1F");
    expect(heroGlow("#1E3A2E")).toBe("#ffffff");
  });
});
