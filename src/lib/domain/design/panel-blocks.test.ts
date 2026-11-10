import { describe, expect, it } from "vitest";
import { BLOCK_MIN, joinBlock, resizeBlock, splitBlock, startingBlocks, trayWords } from "./panel-blocks";

let made = 0;
const id = () => `b${made++}`;

describe("the block tray", () => {
  it("starts as one block, or two about half each for a split", () => {
    expect(startingBlocks(16, false, id).map((b) => b.count)).toEqual([16]);
    expect(startingBlocks(17, true, id).map((b) => b.count)).toEqual([9, 8]);
    expect(startingBlocks(3, true, id).map((b) => b.count)).toEqual([3]);
    expect(startingBlocks(0, true, id)).toEqual([]);
  });
  it("resizes within its limits", () => {
    const [b] = startingBlocks(3, false, id);
    expect(resizeBlock([b], b.id, -5)[0].count).toBe(BLOCK_MIN);
    expect(resizeBlock([b], b.id, 2)[0].count).toBe(5);
  });
  it("splits in place and joins back", () => {
    const blocks = startingBlocks(10, false, id);
    const split = splitBlock(blocks, blocks[0].id, id);
    expect(split.map((b) => b.count)).toEqual([5, 5]);
    expect(joinBlock(split, split[1].id).map((b) => b.count)).toEqual([10]);
    expect(splitBlock(startingBlocks(3, false, id), "nope", id).map((b) => b.count)).toEqual([3]);
  });
  it("says what is left to place", () => {
    expect(trayWords(startingBlocks(16, true, id), 475)).toBe("16 panels to place (7.6 kW)");
  });
});
