import { describe, expect, it } from "vitest";
import { DSM_UNITS, alignTiles, dsmSource, terrainFromTiles, tileValues, tilesFor, worldPixel, type DsmTile } from "./nearmap-dsm";
import { heightAt } from "./shade";

const SIZE = 257;

/** A tile of a made-up world: a roof sloping down to the east over flat ground, measured from a base of its own. */
function tileOf(x: number, y: number, zoom: number, world: (wx: number, wy: number) => number, base: number): DsmTile {
  const values = new Float64Array(SIZE * SIZE);
  for (let j = 0; j < SIZE; j++)
    for (let i = 0; i < SIZE; i++) values[j * SIZE + i] = Math.round((world(x * 256 + i, y * 256 + j) - base) * DSM_UNITS);
  return { x, y, size: SIZE, values };
}

describe("tileValues", () => {
  it("reads red, green and blue as one number, and 0 as no reading", () => {
    const px = [0, 8, 71, 0, 0, 0, 1, 0, 0];
    const v = tileValues(px, 3, 1);
    expect(v[0]).toBe(8 * 256 + 71);
    expect(tileValues(px.slice(3), 3, 1)[0]).toBeNaN();
    expect(tileValues([1, 0, 0, 255], 4, 1)[0]).toBe(65_536);
  });
});

describe("alignTiles", () => {
  it("puts tiles measured from different whole-metre bases back in step", () => {
    const world = (wx: number) => 60 + wx * 0.001;
    const a = tileOf(10, 10, 20, world, 58);
    const b = tileOf(11, 10, 20, world, 56); // 2 m lower base: its numbers 2 m higher
    const c = tileOf(10, 11, 20, world, 59);
    const added = alignTiles([a, b, c]);
    expect(added.get("10,10")).toBe(0);
    expect(added.get("11,10")).toBe(-2 * DSM_UNITS);
    expect(added.get("10,11")).toBe(1 * DSM_UNITS);
  });
});

describe("terrainFromTiles", () => {
  const lat = -37.936943;
  const lng = 145.2429111;
  const zoom = 20;
  const c = worldPixel(lat, lng, zoom);
  // A 6 m high roof 10 world pixels either side of the point, falling 0.4 of a pixel's height a pixel to the east.
  const world = (wx: number, wy: number) => (Math.abs(wx - c.x) < 40 && Math.abs(wy - c.y) < 40 ? 66 - (wx - c.x) * 0.04 : 60);

  it("covers the designer's picture and keeps relative heights across tile edges", () => {
    const tiles = tilesFor(lat, lng, zoom).map((t, i) => tileOf(t.x, t.y, zoom, world, 50 + (i % 3)));
    const t = terrainFromTiles(lat, lng, zoom, tiles);
    expect(t).not.toBeNull();
    const ground = heightAt(t!, 30, 20);
    const roof = heightAt(t!, 0, 0);
    expect(roof - ground).toBeCloseTo(6, 0);
    // It falls to the east: a metre east is lower than a metre west.
    expect(heightAt(t!, -1, 0)).toBeGreaterThan(heightAt(t!, 1, 0));
  });

  it("gives nothing when most of the picture has no reading", () => {
    const tiles = tilesFor(lat, lng, zoom)
      .slice(0, 2)
      .map((t) => tileOf(t.x, t.y, zoom, world, 50));
    expect(terrainFromTiles(lat, lng, zoom, tiles)).toBeNull();
  });
});

describe("dsmSource", () => {
  it("prefers the newest detailed layer, then the newest standard one", () => {
    const surveys = [
      { captured: "2026-09-24", resources: ["tiles:Dsm", "tiles:Vert"] },
      { captured: "2026-01-27", resources: ["tiles:DetailDsm", "tiles:TrueOrtho"] },
    ];
    expect(dsmSource(surveys)).toMatchObject({ survey: { captured: "2026-01-27" }, layer: { type: "DetailDsm", zoom: 20 } });
    expect(dsmSource(surveys.slice(0, 1))).toMatchObject({ layer: { type: "Dsm", zoom: 18 } });
    expect(dsmSource([{ captured: "2026-01-01", resources: ["tiles:Vert"] }])).toBeNull();
  });
});
