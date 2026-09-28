import { describe, expect, it } from "vitest";
import { bestShift, trustworthy, type Grey } from "./image-align";

// An irregular "roof": soft blobs of different sizes and brightness (deterministic), optionally softened.
const BLOBS = Array.from({ length: 40 }, (_, i) => ({
  x: (i * 37) % 130,
  y: (i * 53) % 110,
  r: 3 + ((i * 7) % 9),
  v: ((i * 29) % 60) - 30,
}));
function texture(w: number, h: number, ox = 0, oy = 0, soften = 0): Grey {
  const data = new Float32Array(w * h);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      let v = 128;
      for (const b of BLOBS) v += b.v * Math.exp(-((x + ox - b.x) ** 2 + (y + oy - b.y) ** 2) / (2 * (b.r + soften) ** 2));
      data[y * w + x] = v;
    }
  return { width: w, height: h, data };
}

describe("bestShift", () => {
  it("finds a known shift between two photos of the same roof", () => {
    const a = texture(120, 100);
    const b = texture(120, 100, -6, 4, 1.5); // b shows a point of a at (x + 6, y − 4), a little blurrier
    const s = bestShift(a, b, 12, { x0: 20, y0: 15, x1: 100, y1: 85 });
    expect(s.dx).toBeCloseTo(6, 0);
    expect(s.dy).toBeCloseTo(-4, 0);
    expect(trustworthy(s)).toBe(true);
  });

  it("doesn't trust a match on noise", () => {
    let seed = 7;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647) * 255;
    const noise = (): Grey => ({ width: 80, height: 80, data: Float32Array.from({ length: 6400 }, rnd) });
    expect(trustworthy(bestShift(noise(), noise(), 8))).toBe(false);
  });
});
