import { describe, expect, it } from "vitest";
import {
  TERRAIN_CELL,
  accessColour,
  heightAt,
  packTerrain,
  shadeReport,
  shadedAt,
  sunAccess,
  sunPosition,
  sunSamples,
  unpackTerrain,
  type Terrain,
} from "./shade";

const MELBOURNE = -37.8;

/** A flat block of ground 60 m × 40 m, with `raise` adding height where it says. */
function ground(raise: (x: number, y: number) => number = () => 0): Terrain {
  const widthM = 60;
  const heightM = 40;
  const cols = widthM / TERRAIN_CELL;
  const rows = heightM / TERRAIN_CELL;
  const heights = new Float32Array(cols * rows);
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++)
      heights[r * cols + c] = raise((c + 0.5) * TERRAIN_CELL - widthM / 2, (r + 0.5) * TERRAIN_CELL - heightM / 2);
  return { cols, rows, cell: TERRAIN_CELL, widthM, heightM, heights };
}

describe("where the sun is", () => {
  it("stands in the north at midday in Melbourne, low in winter and high in summer", () => {
    const winter = sunPosition(MELBOURNE, 172, 12);
    const summer = sunPosition(MELBOURNE, 355, 12);
    // 90 − 37.8 ∓ 23.44
    expect(winter.elevation).toBeCloseTo(28.8, 0);
    expect(summer.elevation).toBeCloseTo(75.6, 0);
    for (const noon of [winter, summer]) expect(Math.min(noon.azimuth, 360 - noon.azimuth)).toBeLessThan(1);
  });

  it("rises in the east and sets in the west, and is down at midnight", () => {
    expect(sunPosition(MELBOURNE, 80, 8).azimuth).toBeGreaterThan(45);
    expect(sunPosition(MELBOURNE, 80, 8).azimuth).toBeLessThan(110);
    expect(sunPosition(MELBOURNE, 80, 16).azimuth).toBeGreaterThan(250);
    expect(sunPosition(MELBOURNE, 80, 16).azimuth).toBeLessThan(315);
    expect(sunPosition(MELBOURNE, 80, 0).elevation).toBeLessThan(0);
  });

  it("stands in the south at midday north of the tropics", () => {
    expect(sunPosition(51.5, 172, 12).azimuth).toBeCloseTo(180, 0);
  });

  it("is sampled through the year only while it is up, with more of it in summer", () => {
    const samples = sunSamples(MELBOURNE);
    expect(samples.every((s) => s.elevation > 5 && s.weight > 0)).toBe(true);
    const count = (month: number) => samples.filter((s) => s.month === month).length;
    expect(count(11)).toBeGreaterThan(count(5));
    expect(new Set(samples.map((s) => s.month)).size).toBe(12);
  });
});

describe("the heights as bytes", () => {
  it("come back as they went, to the centimetre, measured from the lowest point", () => {
    const t = ground((x) => 12 + (x > 0 ? 3.456 : 0));
    const back = unpackTerrain(packTerrain(t))!;
    expect([back.cols, back.rows, back.cell, back.widthM, back.heightM]).toEqual([t.cols, t.rows, t.cell, t.widthM, t.heightM]);
    expect(heightAt(back, -10, 0)).toBeCloseTo(0, 2);
    expect(heightAt(back, 10, 0)).toBeCloseTo(3.46, 2);
  });

  it("are refused when they aren't a grid", () => {
    expect(unpackTerrain(new Uint8Array(10))).toBeNull();
    const bytes = packTerrain(ground());
    expect(unpackTerrain(bytes.slice(0, bytes.length - 2))).toBeNull();
  });
});

describe("shade from what stands around", () => {
  const panel = { x: 0, y: 0, tilt: 20, facing: 0 };

  it("leaves a panel on open ground fully open", () => {
    const flat = ground();
    expect(shadedAt(flat, 0, 0, 0.15, sunPosition(MELBOURNE, 172, 12))).toBe(false);
    expect(sunAccess(flat, panel, sunSamples(MELBOURNE)).access).toBe(1);
  });

  it("shades a panel behind a tall wall on the sun's side, most of all in winter", () => {
    // A wall 8 m tall, 4 m to the north (the sun's side in Melbourne), running east-west.
    const wall = ground((_, y) => (y < -4 && y > -6 ? 8 : 0));
    const report = sunAccess(wall, panel, sunSamples(MELBOURNE));
    expect(report.access).toBeLessThan(0.75);
    // Midwinter the sun is under 29° up: the wall (8 m at 4 m is 63°) hides it all day. Midsummer it clears it at noon.
    expect(report.byMonth[5]).toBeLessThan(0.1);
    expect(report.byMonth[11]).toBeGreaterThan(report.byMonth[5] + 0.3);
    expect(shadedAt(wall, 0, 0, 0.15, sunPosition(MELBOURNE, 172, 12))).toBe(true);
    expect(shadedAt(wall, 0, 0, 0.15, sunPosition(MELBOURNE, 355, 12))).toBe(false);
  });

  it("barely shades a panel with the same wall on the far side from the sun", () => {
    const wall = ground((_, y) => (y > 4 && y < 6 ? 8 : 0));
    expect(sunAccess(wall, panel, sunSamples(MELBOURNE)).access).toBeGreaterThan(0.93);
  });

  it("is not shaded by the roof it sits on", () => {
    // A house 10 m square and 5 m tall with a ridge: the panel on top of it.
    const house = ground((x, y) => (Math.abs(x) < 5 && Math.abs(y) < 5 ? 5 + (5 - Math.abs(y)) * 0.4 : 0));
    expect(sunAccess(house, { ...panel, y: -2 }, sunSamples(MELBOURNE)).access).toBeGreaterThan(0.97);
  });

  it("sums a design: its panels together, the worst of them, and how many are shaded", () => {
    const tree = ground((x, y) => (Math.hypot(x - 8, y + 5) < 3 ? 9 : 0));
    const report = shadeReport(
      tree,
      [
        { x: 8, y: 0, tilt: 20, facing: 0 },
        { x: -20, y: 10, tilt: 20, facing: 0 },
      ],
      MELBOURNE,
    );
    expect(report.panels).toHaveLength(2);
    expect(report.panels[0].access).toBeLessThan(report.panels[1].access);
    expect(report.worst).toBe(report.panels[0].access);
    expect(report.access).toBeCloseTo((report.panels[0].access + report.panels[1].access) / 2);
    expect(report.shaded).toBe(1);
    expect(report.byMonth).toHaveLength(12);
    expect(shadeReport(tree, [], MELBOURNE)).toMatchObject({ access: 1, worst: 1, shaded: 0 });
  });
});

describe("the colour of a panel's access", () => {
  it("runs from red through amber to green", () => {
    expect(accessColour(1)).toBe("rgb(34,197,94)");
    expect(accessColour(0.8)).toBe("rgb(245,158,11)");
    expect(accessColour(0.2)).toBe("rgb(239,68,68)");
    expect(accessColour(0.9)).not.toBe(accessColour(1));
  });
});
