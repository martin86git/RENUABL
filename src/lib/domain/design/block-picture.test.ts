import { describe, expect, it } from "vitest";
import { blocksAreUsual, blocksForView, cleanBlocks, cleanPicturePlace, cleanPictureSize, defaultBlocks } from "./blocks";

const IMG = "img_0123456789abcdef";
const images = [{ id: IMG, kind: "block", width: 1600, height: 1200 }];

describe("a block picture's size and place", () => {
  it("keeps a width share between a fifth and the whole room, in whole numbers", () => {
    expect(cleanPictureSize(55.4)).toBe(55);
    expect(cleanPictureSize(5)).toBe(20);
    expect(cleanPictureSize(400)).toBe(100);
    expect(cleanPictureSize("60")).toBe(100);
    expect(cleanPictureSize(Number.NaN)).toBe(100);
  });

  it("keeps a place from 0 to 100, else the middle", () => {
    expect(cleanPicturePlace(-10)).toBe(0);
    expect(cleanPicturePlace(130)).toBe(100);
    expect(cleanPicturePlace(33.6)).toBe(34);
    expect(cleanPicturePlace(undefined)).toBe(50);
  });

  it("is kept on a block, and never on the standard terms", () => {
    const blocks = cleanBlocks([
      { id: "custom-1", on: true, image: IMG, size: 40, x: 0, y: 100 },
      { id: "terms", size: 30, x: 0 },
    ]);
    expect(blocks.find((b) => b.id === "custom-1")).toMatchObject({ size: 40, x: 0, y: 100 });
    expect(blocks.find((b) => b.id === "terms")).toMatchObject({ size: 100, x: 50, y: 50 });
  });

  it("goes on the published copy only when it isn't the usual full width in the middle", () => {
    const moved = cleanBlocks([{ id: "custom-1", on: true, image: IMG, size: 40, x: 0 }]);
    expect(blocksForView("custom", moved, images).find((b) => b.id === "custom-1")).toMatchObject({ size: 40, x: 0, y: 50 });
    const usual = cleanBlocks([{ id: "custom-1", on: true, image: IMG }]);
    expect(blocksForView("custom", usual, images).find((b) => b.id === "custom-1")).not.toHaveProperty("size");
  });

  it("makes a kit custom once a picture is moved", () => {
    expect(blocksAreUsual(defaultBlocks())).toBe(true);
    expect(blocksAreUsual(defaultBlocks().map((b) => (b.id === "about" ? { ...b, size: 60 } : b)))).toBe(false);
  });
});
