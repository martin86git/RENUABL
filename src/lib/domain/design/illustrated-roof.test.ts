import { describe, expect, it } from "vitest";
import {
  ROOF_LIGHT,
  WALL,
  cellLines,
  colourInside,
  faceColour,
  ghosted,
  gutterOf,
  inside,
  wallLayout,
  type Pixels,
} from "./illustrated-roof";

/** A picture of one colour, with a patch of another. */
function picture(
  width: number,
  height: number,
  base: number[],
  patch?: { x: number; y: number; w: number; h: number; c: number[] },
): Pixels {
  const data = new Array<number>(width * height * 4);
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const inPatch = patch && x >= patch.x && x < patch.x + patch.w && y >= patch.y && y < patch.y + patch.h;
      const c = inPatch ? patch.c : base;
      data.splice((y * width + x) * 4, 4, c[0], c[1], c[2], 255);
    }
  return { data, width, height };
}

const square = [
  [2, 2],
  [8, 2],
  [8, 8],
  [2, 8],
] as const;

const light = (hex: string) => {
  const n = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  return 0.299 * n[0] + 0.587 * n[1] + 0.114 * n[2];
};

describe("the roof's colour from the photo", () => {
  it("tells inside an outline from outside", () => {
    expect(inside(square, 5, 5)).toBe(true);
    expect(inside(square, 1, 5)).toBe(false);
    expect(inside(square, 9, 9)).toBe(false);
  });

  it("is the colour inside the outline, not round it", () => {
    const p = picture(12, 12, [20, 200, 20], { x: 2, y: 2, w: 6, h: 6, c: [180, 90, 60] });
    expect(colourInside(p, square)).toEqual([180, 90, 60]);
  });

  it("leaves out shadows and panels already there", () => {
    const p = picture(12, 12, [180, 90, 60], { x: 2, y: 2, w: 3, h: 6, c: [10, 12, 18] });
    expect(colourInside(p, square)).toEqual([180, 90, 60]);
  });

  it("uses the dark when a face is nothing else, and nothing off the picture", () => {
    expect(colourInside(picture(12, 12, [10, 12, 18]), square)).toEqual([10, 12, 18]);
    expect(
      colourInside(picture(4, 4, [9, 9, 9]), [
        [20, 20],
        [30, 20],
        [30, 30],
      ]),
    ).toBeNull();
  });
});

describe("a face's colour", () => {
  it("keeps a roof in the middle range, however dark or pale the photo", () => {
    expect(light(faceColour([20, 20, 24], [20, 20, 24], 0, 0))).toBeGreaterThanOrEqual(ROOF_LIGHT.low - 1);
    expect(light(faceColour([250, 250, 250], [250, 250, 250], 0, 0))).toBeLessThanOrEqual(ROOF_LIGHT.high + 1);
  });

  it("lights a face looking north-west more than one looking south-east, and a flat one in between", () => {
    const roof: [number, number, number] = [150, 110, 90];
    const lit = light(faceColour(roof, roof, 315, 22));
    const flat = light(faceColour(roof, roof, 315, 0));
    const away = light(faceColour(roof, roof, 135, 22));
    expect(lit).toBeGreaterThan(flat);
    expect(flat).toBeGreaterThan(away);
  });

  it("keeps the roof's colour: a terracotta roof stays red", () => {
    const hex = faceColour([170, 90, 60], [170, 90, 60], 0, 20);
    expect(parseInt(hex.slice(1, 3), 16)).toBeGreaterThan(parseInt(hex.slice(5, 7), 16) + 40);
  });

  it("draws a plain grey when the photo can't be read", () => {
    expect(faceColour(null, null, 0, 0)).toMatch(/^#[0-9a-f]{6}$/);
  });
});

describe("the gutter", () => {
  it("is the lowest edge across the slope", () => {
    // A face looking north (down the slope is up the picture): its gutter is the top edge.
    expect(gutterOf(square, 0, 22)).toEqual([
      [2, 2],
      [8, 2],
    ]);
    // Looking south: the bottom edge.
    expect(gutterOf(square, 180, 22)).toEqual([
      [8, 8],
      [2, 8],
    ]);
  });

  it("isn't drawn on a flat roof", () => {
    expect(gutterOf(square, 0, 1)).toBeNull();
  });
});

describe("the surroundings", () => {
  it("are greyed and dimmed in place", () => {
    const data = [200, 40, 40, 255];
    ghosted(data);
    expect(data[0]).toBeLessThan(100);
    expect(data[0] - data[1]).toBeLessThan(40);
    expect(data[3]).toBe(255);
  });
});

describe("a panel's cells", () => {
  it("run one line down its length and five across it", () => {
    const portrait = [
      [0, 0],
      [10, 0],
      [10, 20],
      [0, 20],
    ] as const;
    const lines = cellLines(portrait);
    expect(lines).toHaveLength(6);
    // The middle line runs down the long side.
    expect(lines[0]).toEqual([
      [5, 0],
      [5, 20],
    ]);
    expect(cellLines(portrait.slice(0, 3))).toEqual([]);
  });
});

describe("the wall", () => {
  it("is empty with nothing on the design", () => {
    expect(wallLayout({ inverters: [], battery: null, charger: null, switchboard: false })).toEqual({ items: [], width: 0 });
  });

  it("stands the inverter, the battery, the switchboard and the charger in order on the floor", () => {
    const { items, width } = wallLayout({
      inverters: [{ name: "Hybrid", kw: 10 }],
      battery: { name: "Stack", kwh: 8, qty: 3, backup: true },
      charger: { name: "Charger", kw: 7 },
      switchboard: true,
    });
    expect(items.map((i) => i.kind)).toEqual(["inverter", "battery", "switchboard", "charger"]);
    expect(items.map((i) => i.label)).toEqual(["10 kW", "24 kWh", "MSB", "EV 7 kW"]);
    for (const item of items) expect(item.y + item.h).toBe(WALL.floor);
    for (let i = 1; i < items.length; i++) expect(items[i].x).toBeGreaterThan(items[i - 1].x + items[i - 1].w);
    expect(width).toBeGreaterThan(items[3].x + items[3].w);
    expect(items[1]).toMatchObject({ modules: 3, held: 1 });
  });

  it("grows the battery with its modules, up to what is drawn", () => {
    const stack = (qty: number) =>
      wallLayout({ inverters: [], battery: { name: "b", kwh: 8, qty, backup: false }, charger: null, switchboard: false }).items[0];
    expect(stack(4).h).toBeGreaterThan(stack(1).h);
    expect(stack(16).modules).toBe(WALL.most);
    expect(stack(1).held).toBe(0);
  });
});
