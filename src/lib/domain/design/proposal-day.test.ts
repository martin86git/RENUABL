import { describe, expect, it } from "vitest";
import { DAY_NOTE_YOURS, DAY_SEASONS, dayWords, homeDay } from "./home-day";
import { buildProposal, viewForChoice, type ProposalView } from "./proposal";
import { sampleInputs } from "./proposal-fixture";
import { MONTH_DAYS } from "./tilt";

/** The day as the customer's page works it out: from the customer's copy alone. */
function dayOf(view: ProposalView, month: number) {
  const each = view.system.kw / view.system.panels;
  return homeDay({
    latitude: view.roof.lat,
    month,
    panels: view.roof.panels.map((_, n) => ({
      kw: each,
      tilt: view.roof.aspects?.[n]?.[0] ?? 22,
      facing: view.roof.aspects?.[n]?.[1] ?? 0,
    })),
    dayKwh: (view.production?.monthlyKwh[month] ?? 0) / MONTH_DAYS[month],
    homeDayKwh: view.bill?.dailyKwh ?? null,
    batteryKwh: (view.system.eveningKwh ?? view.system.batteryKwh) * 0.9,
  });
}

describe("the home's day on a proposal", () => {
  const built = buildProposal(sampleInputs({ withBattery: true }));
  if (!built.ok) throw new Error(built.problems.join(" "));
  const { view } = built;

  it("is sent each panel's tilt and facing, one for one with the panels", () => {
    expect(view.roof.panels.length).toBeGreaterThan(0);
    expect(view.roof.aspects).toHaveLength(view.roof.panels.length);
    for (const [tilt, facing] of view.roof.aspects!) {
      expect(tilt).toBeGreaterThanOrEqual(0);
      expect(tilt).toBeLessThanOrEqual(60);
      expect(facing).toBeGreaterThanOrEqual(0);
      expect(facing).toBeLessThan(360);
    }
  });

  it("is sent what of the battery carries the evenings, never more than the battery", () => {
    expect(view.system.eveningKwh).toBeGreaterThan(0);
    expect(view.system.eveningKwh!).toBeLessThanOrEqual(view.system.batteryKwh);
  });

  it("makes in a day what the proposal's own output says for that month", () => {
    for (const season of DAY_SEASONS) {
      const day = dayOf(view, season.month);
      const said = view.production!.monthlyKwh[season.month] / MONTH_DAYS[season.month];
      expect(Math.abs(day.solarKwh - said)).toBeLessThan(0.2);
      expect(day.shadeLoss).toBe(0);
    }
  });

  it("uses in a day what the bill says the home uses", () => {
    if (!view.bill) return;
    expect(Math.abs(dayOf(view, 0).useKwh - view.bill.dailyKwh)).toBeLessThan(0.2);
  });

  it("follows the system the customer chooses", () => {
    const solar = sampleInputs();
    const battery = sampleInputs({ withBattery: true });
    const quotes = [solar.project.extras.quotes[0], battery.project.extras.quotes[0]];
    const both = buildProposal(
      sampleInputs({
        project: {
          ...battery.project,
          set: {
            ...battery.project.set,
            designs: [
              { ...solar.project.set.designs[0], goal: "payback" as const },
              { ...battery.project.set.designs[0], goal: "return" as const },
            ],
            primary: 1,
          },
          extras: { ...battery.project.extras, quotes },
        },
      }),
    );
    if (!both.ok) throw new Error(both.problems.join(" "));
    for (const option of both.view.options ?? []) {
      expect(option.roofAspects).toHaveLength(option.roofPanels.length);
      const chosen = viewForChoice(both.view, option.goal);
      expect(chosen.roof.aspects).toEqual(option.roofAspects);
      expect(chosen.system.eveningKwh).toBe(option.system.eveningKwh);
    }
  });

  it("still has a day on a proposal published before tilt and facing were kept", () => {
    const older: ProposalView = { ...view, roof: { lat: view.roof.lat, lng: view.roof.lng, panels: view.roof.panels } };
    expect(dayOf(older, 5).solarKwh).toBeGreaterThan(0);
  });

  it("is worded for the customer, as an estimate, with no promise in it", () => {
    for (const season of DAY_SEASONS) {
      const words = [...dayWords(dayOf(view, season.month), season.label, true, true), DAY_NOTE_YOURS].join(" ");
      expect(words).not.toMatch(/the home\b/);
      expect(words).not.toMatch(/\$|guaranteed to|exact|precise|100%|never need|free of the grid|off.grid|you will save|cost|margin/i);
    }
    expect(DAY_NOTE_YOURS).toMatch(/estimate/i);
    expect(DAY_NOTE_YOURS).toMatch(/nothing guaranteed/i);
    expect(DAY_NOTE_YOURS).toMatch(/leaves out shade/i);
  });
});
