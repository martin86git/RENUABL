import { describe, expect, it } from "vitest";
import {
  COST_WORDS,
  GOAL_WORDS,
  buildProposal,
  internalForChoice,
  offeredDesigns,
  recommendedAt,
  recommendedGoal,
  viewForChoice,
} from "./proposal";
import { sampleInputs } from "./proposal-fixture";
import { costSystem, editedLines, lineKey, type LineEdit } from "./quote";
import { systemSpecOf } from "./system";
import type { RoofDesign } from "./roof-design";

/** A roof with two goal designs: solar only for the quickest payback, and solar with a battery for the maximum return (the primary). */
function twoGoals() {
  const solar = sampleInputs();
  const battery = sampleInputs({ withBattery: true });
  const designs = [
    { ...solar.project.set.designs[0], goal: "payback" as const, label: "Fastest payback" },
    { ...battery.project.set.designs[0], goal: "return" as const, label: "Best return" },
  ];
  const quotes = designs.map((d) => {
    const form = solar.project.extras.quotes[0].form;
    const edits: Record<string, LineEdit> = {};
    for (const line of editedLines(costSystem(systemSpecOf(d), form, solar.workspace).lines, {}))
      if (line.missing) edits[lineKey(line)] = { amount: 100 };
    return { form, edits };
  });
  return sampleInputs({
    project: {
      ...solar.project,
      set: { ...solar.project.set, designs, primary: 1 },
      extras: { ...solar.project.extras, quotes },
    },
  });
}

describe("a proposal with a choice of systems", () => {
  const built = buildProposal(twoGoals());
  if (!built.ok) throw new Error(built.problems.join(" "));
  const { view, internal } = built;

  it("offers each goal design, in goal order, with the primary recommended", () => {
    expect(view.options?.map((o) => [o.goal, o.name, o.recommended])).toEqual([
      ["payback", GOAL_WORDS.payback.name, false],
      ["return", GOAL_WORDS.return.name, true],
    ]);
    expect(recommendedGoal(view)).toBe("return");
  });

  it("prices each in full, the battery one dearer and the solar one paying back sooner", () => {
    const [solar, battery] = view.options!;
    expect(battery.system.batteryKwh).toBeGreaterThan(0);
    expect(solar.system.batteryKwh).toBe(0);
    expect(battery.price.youPay).toBeGreaterThan(solar.price.youPay);
    // The rest of the proposal shows the recommended one.
    expect(view.price.youPay).toBe(battery.price.youPay);
  });

  it("swaps everything that differs when the customer chooses another", () => {
    const chosen = viewForChoice(view, "payback");
    const solar = view.options![0];
    expect(chosen.price.youPay).toBe(solar.price.youPay);
    expect(chosen.system).toEqual(solar.system);
    expect(chosen.roof.panels).toEqual(solar.roofPanels);
    expect(chosen.terms?.deposit).toBe(solar.deposit);
    expect(viewForChoice(view, "independence")).toBe(view);
    // And the business's side, for the order and the installation allowance.
    expect(internalForChoice(internal, "payback").lines.some((l) => l.group === "Battery")).toBe(false);
    expect(internalForChoice(internal, "return").lines.some((l) => l.group === "Battery")).toBe(true);
  });

  it("carries no cost, margin or product code in what the customer is sent", () => {
    const keys: string[] = [];
    const walk = (v: unknown) => {
      if (Array.isArray(v)) v.forEach(walk);
      else if (v && typeof v === "object")
        for (const [k, x] of Object.entries(v)) {
          keys.push(k.toLowerCase());
          walk(x);
        }
    };
    walk(view.options);
    for (const word of COST_WORDS) expect(keys).not.toContain(word.toLowerCase());
    const sent = JSON.stringify(view.options);
    for (const o of internal.options!) for (const secret of [o.cost, o.margin, o.priceExGst]) expect(sent).not.toContain(String(secret));
  });

  it("offers no choice with a single design", () => {
    const one = buildProposal(sampleInputs());
    expect(one.ok && one.view.options).toBeUndefined();
  });
});

describe("designs offered by hand", () => {
  const d = (extra: object = {}) => ({ faces: [], loose: [], lat: 0, lng: 0, ...extra }) as unknown as RoofDesign;
  it("offers the primary first and then the designs marked, up to five", () => {
    const set = {
      primary: 1,
      designs: [
        d({ offer: true }),
        d(),
        d({ offer: true }),
        d({ offer: true }),
        d({ offer: true }),
        d({ offer: true }),
        d({ offer: true }),
      ],
    };
    const out = offeredDesigns(set);
    expect(out.map((o) => o.at)).toEqual([1, 0, 2, 3, 4]);
    expect(out.map((o) => o.goal)).toEqual(["design-1", "design-0", "design-2", "design-3", "design-4"]);
    expect(out.map((o) => o.name)).toEqual(["Option 1", "Option 2", "Option 3", "Option 4", "Option 5"]);
  });
  it("calls a goal design by its goal, never by the designer's own label", () => {
    const set = { primary: 0, designs: [d({ label: "Note to self" }), d({ offer: true, goal: "return", label: "Secret" })] };
    const out = offeredDesigns(set);
    expect(out[1].name).toBe("Maximum return");
    expect(JSON.stringify(out)).not.toContain("Secret");
    expect(JSON.stringify(out)).not.toContain("Note to self");
  });
  it("marks the design recommended, else the primary", () => {
    const set = { primary: 0, designs: [d(), d({ offer: true, recommended: true })] };
    expect(recommendedAt(set, offeredDesigns(set))).toBe(1);
    expect(recommendedAt({ ...set, designs: [d(), d({ offer: true })] }, offeredDesigns(set))).toBe(0);
  });
  it("falls back to the goal designs, and offers nothing with one design", () => {
    expect(offeredDesigns({ primary: 0, designs: [d({ goal: "payback" }), d({ goal: "return" })] }).map((o) => o.goal)).toEqual([
      "payback",
      "return",
    ]);
    expect(offeredDesigns({ primary: 0, designs: [d()] })).toEqual([]);
  });
});

describe("a proposal with designs offered by hand", () => {
  it("prices each offered design as an option, keyed by its place, the recommended one marked", () => {
    const base = twoGoals();
    const designs = base.project.set.designs.map((d, i) => {
      const { goal: _g, label: _l, ...rest } = d;
      void _g;
      void _l;
      return i === 0 ? { ...rest, offer: true as const, recommended: true as const } : rest;
    });
    const input = { ...base, project: { ...base.project, set: { ...base.project.set, designs } } };
    const built = buildProposal(input);
    expect(built.ok).toBe(true);
    if (!built.ok) return;
    expect(built.view.options?.map((o) => [o.goal, o.name, o.recommended])).toEqual([
      ["design-1", "Option 1", false],
      ["design-0", "Option 2", true],
    ]);
    expect(recommendedGoal(built.view)).toBe("design-0");
    expect(internalForChoice(built.internal, "design-0").design).toBe(0);
    expect(viewForChoice(built.view, "design-0").price.youPay).toBe(built.view.options?.[1].price.youPay);
  });
});
