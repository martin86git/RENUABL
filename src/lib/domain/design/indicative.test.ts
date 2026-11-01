import { describe, expect, it } from "vitest";
import {
  FEEDBACK_MISSING,
  INDICATIVE_INTRO,
  INDICATIVE_NOT_ACCEPTABLE,
  INDICATIVE_PRICE_NOTE,
  INDICATIVE_STEPS,
  buildProposal,
  feedbackMessage,
  published,
} from "./proposal";
import { NOT_ON_INDICATIVE, viewBlocks } from "./blocks";
import { sampleInputs } from "./proposal-fixture";

const built = (indicative: boolean) => {
  const base = sampleInputs();
  const out = buildProposal({ ...base, choice: { ...base.choice, indicative } });
  if (!out.ok) throw new Error(out.problems.join("; "));
  return out.view;
};

describe("an indicative proposal", () => {
  it("is marked on the customer's copy only when chosen", () => {
    expect(built(true).indicative).toBe(true);
    expect(built(false)).not.toHaveProperty("indicative");
  });
  it("is priced exactly as a final one: only what it lets the customer do differs", () => {
    expect(built(true).price).toEqual(built(false).price);
  });
  it("sets out the way of working in three steps, ending in a final proposal the customer accepts", () => {
    expect(INDICATIVE_STEPS.map((s) => s.name)).toEqual(["Indicative proposal", "Site visit", "Final proposal"]);
    expect(INDICATIVE_STEPS[2].words).toMatch(/until you accept/);
  });
  it("promises nothing (Australian Consumer Law)", () => {
    const all = [
      INDICATIVE_INTRO,
      INDICATIVE_PRICE_NOTE,
      INDICATIVE_NOT_ACCEPTABLE,
      FEEDBACK_MISSING,
      ...INDICATIVE_STEPS.map((s) => s.words),
    ];
    expect(all.join(" ")).not.toMatch(/guarantee|exact|precise|will save|best|RENUABL|\bAI\b|\$\d/i);
  });
  it("turns the customer's thoughts into one chat message", () => {
    expect(feedbackMessage({ name: "Maximum return" }, "  Can the battery go in the garage?  ")).toBe(
      "Maximum return suits us best.\n\nCan the battery go in the garage?",
    );
    expect(feedbackMessage(null, "Just a note")).toBe("Just a note");
    expect(feedbackMessage({ name: "Quickest payback" }, "")).toBe("Quickest payback suits us best.");
    expect(feedbackMessage(null, "   ")).toBe("");
  });
  it("is named as indicative on the customer's record", () => {
    expect(published(1, true)).toBe("Indicative proposal sent");
    expect(published(2, true)).toBe("Indicative proposal (version 2) sent");
    expect(published(1)).toBe("Proposal sent");
  });
});

describe("what an indicative proposal shows", () => {
  it("leaves out paying, and the conditions and terms going ahead accepts", () => {
    const view = built(true);
    const ids = viewBlocks(view).map((b) => b.id);
    for (const id of NOT_ON_INDICATIVE) expect(ids).not.toContain(id);
    expect(ids).toContain("price");
    expect(ids).toContain("accept");
    expect(viewBlocks(built(false)).map((b) => b.id)).toEqual(viewBlocks({ blocks: built(false).blocks }).map((b) => b.id));
  });
});
