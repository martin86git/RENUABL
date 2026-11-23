import { describe, expect, it } from "vitest";
import { lineupWords, proposalLineup, withLeading, withOnProposal, withRecommended } from "./proposal-lineup";
import type { RoofDesign } from "./roof-design";

const d = (more: Partial<RoofDesign> = {}): RoofDesign => ({ faces: [], name: "x", ...more }) as RoofDesign;

describe("proposal line-up", () => {
  it("is the leading design alone by default", () => {
    const set = { primary: 0, designs: [d(), d(), d()] };
    expect(proposalLineup(set)).toEqual({ on: [0], recommended: null });
    expect(lineupWords(proposalLineup(set))).toBe("Only Design 1 goes on the proposal.");
  });

  it("adds and removes an option, recommending the leading one unless another is", () => {
    const set = { primary: 0, designs: [d(), d(), d()] };
    const two = withOnProposal(set, 2, true)!;
    expect(proposalLineup({ primary: 0, designs: two })).toEqual({ on: [0, 2], recommended: 0 });
    const rec = withRecommended({ primary: 0, designs: two }, 2);
    const l = proposalLineup({ primary: 0, designs: rec });
    expect(l.recommended).toBe(2);
    expect(lineupWords(l)).toBe("2 options on the proposal: Design 1 and Design 3 (recommended).");
    const back = withOnProposal({ primary: 0, designs: rec }, 2, false)!;
    expect(proposalLineup({ primary: 0, designs: back })).toEqual({ on: [0], recommended: null });
  });

  it("keeps the leading design alone once the goal designs are taken off", () => {
    const set = { primary: 0, designs: [d({ goal: "payback" }), d({ goal: "return" }), d({ goal: "independence" })] };
    expect(proposalLineup(set).on).toEqual([0, 1, 2]);
    const fewer = withOnProposal(set, 1, false)!;
    expect(proposalLineup({ primary: 0, designs: fewer }).on).toEqual([0, 2]);
    const alone = withOnProposal({ primary: 0, designs: fewer }, 2, false)!;
    expect(proposalLineup({ primary: 0, designs: alone }).on).toEqual([0]);
  });

  it("refuses more than five on the proposal", () => {
    let designs = [d(), d(), d(), d(), d(), d()];
    for (const i of [1, 2, 3, 4]) designs = withOnProposal({ primary: 0, designs }, i, true)!;
    expect(withOnProposal({ primary: 0, designs }, 5, true)).toBeNull();
  });

  it("keeps the line-up when the leading design changes", () => {
    const designs = withOnProposal({ primary: 0, designs: [d(), d(), d()] }, 1, true)!;
    const moved = withLeading({ primary: 0, designs }, 1);
    expect(proposalLineup({ primary: 1, designs: moved }).on.sort()).toEqual([0, 1]);
    const alone = withLeading({ primary: 0, designs: [d(), d()] }, 1);
    expect(proposalLineup({ primary: 1, designs: alone }).on).toEqual([1]);
  });
});
