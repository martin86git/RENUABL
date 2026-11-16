import { describe, expect, it } from "vitest";
import { customPriceWords, mayPublishCustom } from "./custom-proposals";
import { blocksAreUsual, blocksForView, defaultBlocks, nextOwnBlock, placeBlock } from "./blocks";

describe("custom proposals", () => {
  it("are held back only once priced and billing is enforced, without the add-on", () => {
    expect(mayPublishCustom({ enforced: false, cents: 4900, hasAddOn: false })).toBe(true);
    expect(mayPublishCustom({ enforced: true, cents: null, hasAddOn: false })).toBe(true);
    expect(mayPublishCustom({ enforced: true, cents: 4900, hasAddOn: false })).toBe(false);
    expect(mayPublishCustom({ enforced: true, cents: 4900, hasAddOn: true })).toBe(true);
  });

  it("says the price once it is set", () => {
    expect(customPriceWords(null)).toMatch(/included/);
    expect(customPriceWords(4900)).toBe("Custom proposals come with Growth, $49 a month for your whole business, including GST.");
  });
});

describe("the builder's blocks", () => {
  it("drops a block where it is let go, never before the cover or after the standard terms", () => {
    const blocks = defaultBlocks();
    const ids = (list: { id: string }[]) => list.map((b) => b.id);
    const moved = placeBlock(blocks, "price", 1);
    expect(ids(moved)[0]).toBe("cover");
    expect(ids(moved)[1]).toBe("price");
    expect(ids(placeBlock(blocks, "price", 0))[0]).toBe("cover");
    expect(ids(placeBlock(blocks, "system", blocks.length)).at(-1)).toBe("terms");
    expect(placeBlock(blocks, "terms", 1)).toEqual(blocks);
    expect(moved).toHaveLength(blocks.length);
  });

  it("publishes the usual blocks with the standard design, and the business's own with a custom one", () => {
    const own = defaultBlocks().map((b) => (b.id === "custom-1" ? { ...b, on: true, words: "Our team", tone: "dark" as const } : b));
    expect(blocksForView("standard", own, []).some((b) => b.id === "custom-1")).toBe(false);
    const custom = blocksForView("custom", own, []);
    expect(custom.find((b) => b.id === "custom-1")).toMatchObject({ words: "Our team", tone: "dark" });
    expect(blocksAreUsual(defaultBlocks())).toBe(true);
    expect(blocksAreUsual(own)).toBe(false);
    expect(nextOwnBlock(own)).toBe("custom-2");
  });
});
