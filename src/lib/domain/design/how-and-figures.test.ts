import { describe, expect, it } from "vitest";
import { blocksAreUsual, cleanBlocks, coverTitle, defaultBlocks, moveBlock, stepsShown, viewBlocks } from "./blocks";
import { INDICATIVE_STEPS } from "./proposal";

// 19 Nov 2026, Martin: How we work and the three figures were fixed in the cover; now blocks to reword, hide and move.
describe("How we work and At a glance as blocks", () => {
  it("sit under the cover to start", () => {
    expect(
      defaultBlocks()
        .map((b) => b.id)
        .slice(0, 5),
    ).toEqual(["cover", "options", "hero", "how", "figures"]);
  });
  it("go back under the cover for a kit saved before them, which still reads as the usual design", () => {
    const before = defaultBlocks().filter((b) => b.id !== "how" && b.id !== "figures");
    const cleaned = cleanBlocks(before);
    expect(cleaned.map((b) => b.id).slice(0, 5)).toEqual(["cover", "options", "hero", "how", "figures"]);
    expect(blocksAreUsual(cleaned)).toBe(true);
  });
  it("keep the business's step wording, cleaned, and only for How we work", () => {
    const blocks = cleanBlocks([
      { id: "cover" },
      { id: "how", steps: [{ name: " Free quote ", words: "<b>We look</b>" }, {}, { name: "x".repeat(99) }] },
      { id: "figures", steps: [{ name: "No" }] },
    ]);
    const how = blocks.find((b) => b.id === "how")!;
    expect(how.steps?.[0].name).toBe("Free quote");
    expect(how.steps?.[0].words).not.toMatch(/[<>]/);
    expect(how.steps?.[2].name).toHaveLength(40);
    expect(blocks.find((b) => b.id === "figures")!.steps).toBeUndefined();
    expect(blocksAreUsual(blocks)).toBe(false);
    expect(cleanBlocks([{ id: "how", steps: [{}, {}, {}] }]).find((b) => b.id === "how")!.steps).toBeUndefined();
  });
  it("show our wording where a step is left blank", () => {
    const shown = stepsShown([{ name: "Free quote", words: "" }], INDICATIVE_STEPS);
    expect(shown[0]).toEqual({ name: "Free quote", words: INDICATIVE_STEPS[0].words });
    expect(shown.slice(1)).toEqual(INDICATIVE_STEPS.slice(1));
  });
  it("can be hidden or moved, and How we work shows only on an indicative proposal", () => {
    const blocks = cleanBlocks(defaultBlocks().map((b) => (b.id === "figures" ? { ...b, on: false } : b)));
    expect(blocks.find((b) => b.id === "figures")!.on).toBe(false);
    const view = (indicative: boolean) =>
      viewBlocks({
        indicative,
        blocks: [
          { id: "cover", heading: "", words: "", image: null },
          { id: "how", heading: "", words: "", image: null },
        ],
      }).map((b) => b.id);
    expect(view(true)).toContain("how");
    expect(view(false)).not.toContain("how");
  });
  it("stay in place for a proposal published before they were blocks", () => {
    const old = [
      { id: "cover" as const, heading: "", words: "", image: null },
      { id: "price" as const, heading: "", words: "", image: null },
    ];
    expect(viewBlocks({ indicative: true, blocks: old }).map((b) => b.id)).toEqual(["cover", "options", "hero", "how", "figures", "price"]);
    // Published with How we work and At a glance as blocks, before the cover's other parts were: those go back under the cover.
    const set2 = [old[0], { id: "figures" as const, heading: "", words: "", image: null }, old[1]];
    expect(viewBlocks({ blocks: set2 }).map((b) => b.id)).toEqual(["cover", "options", "hero", "figures", "price"]);
    // Published knowing them all: what the business hid stays hidden.
    expect(viewBlocks({ blocks: old, blockSet: 3 }).map((b) => b.id)).toEqual(["cover", "price"]);
  });
  it("move past a hidden block in one press", () => {
    const blocks = defaultBlocks().map((b) => (b.id === "figures" ? { ...b, on: false } : b));
    const shown = (list: typeof blocks) =>
      list
        .filter((b) => b.on)
        .map((b) => b.id)
        .slice(3, 5);
    expect(shown(moveBlock(blocks, "how", 1))).toEqual(["system", "how"]);
    expect(shown(moveBlock(moveBlock(blocks, "how", 1), "how", -1))).toEqual(["how", "system"]);
  });
});

describe("the cover's title", () => {
  const view = { title: "Solar and battery", customer: { name: "Doug Mitchell" } };
  it("is ours unless the business gives its own", () => {
    expect(coverTitle("", view)).toBe("Solar and battery for Doug Mitchell");
    expect(coverTitle(undefined, view)).toBe("Solar and battery for Doug Mitchell");
  });
  it("fills in each customer's name and system, since it is used on every proposal", () => {
    expect(coverTitle("{firstName}'s home, powered by the sun", view)).toBe("Doug's home, powered by the sun");
    expect(coverTitle("{system} for { name }", view)).toBe("Solar and battery for Doug Mitchell");
  });
});
