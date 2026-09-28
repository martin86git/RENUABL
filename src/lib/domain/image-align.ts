/**
 * Finds how far one greyscale image is shifted against another (normalised
 * cross-correlation over a search window), with a confidence check. Used to
 * line the sharp Maps Static satellite photo up with Google Solar's own photo,
 * whose geometry matches the panel spots. Pure and tested.
 */

export interface Grey {
  width: number;
  height: number;
  /** Row by row, one value a pixel; NaN where there's no picture. */
  data: Float32Array;
}

export interface Shift {
  /** Pixels to add to a point in `a` to find it in `b`. */
  dx: number;
  dy: number;
  /** Correlation at the best shift (−1 to 1). */
  score: number;
  /** How far the best beats the next separate peak. */
  margin: number;
}

function ncc(a: Grey, b: Grey, dx: number, dy: number, region: { x0: number; y0: number; x1: number; y1: number }) {
  let n = 0;
  let sa = 0;
  let sb = 0;
  let saa = 0;
  let sbb = 0;
  let sab = 0;
  for (let y = region.y0; y < region.y1; y++) {
    const yb = y + dy;
    if (yb < 0 || yb >= b.height) continue;
    for (let x = region.x0; x < region.x1; x++) {
      const xb = x + dx;
      if (xb < 0 || xb >= b.width) continue;
      const va = a.data[y * a.width + x];
      const vb = b.data[yb * b.width + xb];
      if (Number.isNaN(va) || Number.isNaN(vb)) continue;
      n++;
      sa += va;
      sb += vb;
      saa += va * va;
      sbb += vb * vb;
      sab += va * vb;
    }
  }
  if (n < 200) return -1;
  const cov = sab - (sa * sb) / n;
  const va = saa - (sa * sa) / n;
  const vb = sbb - (sb * sb) / n;
  return va > 1e-6 && vb > 1e-6 ? cov / Math.sqrt(va * vb) : -1;
}

/**
 * The shift of `b` against `a` within ±maxShift pixels, compared over `region`
 * of `a` (e.g. the roof). Sub-pixel by fitting a parabola through the peak.
 */
export function bestShift(a: Grey, b: Grey, maxShift: number, region = { x0: 0, y0: 0, x1: a.width, y1: a.height }): Shift {
  const size = 2 * maxShift + 1;
  const scores = new Float64Array(size * size);
  let best = { dx: 0, dy: 0, score: -Infinity };
  for (let dy = -maxShift; dy <= maxShift; dy++) {
    for (let dx = -maxShift; dx <= maxShift; dx++) {
      const s = ncc(a, b, dx, dy, region);
      scores[(dy + maxShift) * size + dx + maxShift] = s;
      if (s > best.score) best = { dx, dy, score: s };
    }
  }
  // The strongest other peak (a local maximum away from the best): a repeating
  // pattern, like rows of roof tiles, shows up as several peaks of similar height.
  const score = (dx: number, dy: number) =>
    Math.abs(dx) > maxShift || Math.abs(dy) > maxShift ? -Infinity : scores[(dy + maxShift) * size + dx + maxShift];
  let runnerUp = -1;
  for (let dy = -maxShift; dy <= maxShift; dy++) {
    for (let dx = -maxShift; dx <= maxShift; dx++) {
      if (Math.max(Math.abs(dx - best.dx), Math.abs(dy - best.dy)) < 2) continue;
      const v = score(dx, dy);
      let peak = true;
      for (let j = -1; j <= 1 && peak; j++) for (let i = -1; i <= 1 && peak; i++) if ((i || j) && score(dx + i, dy + j) > v) peak = false;
      if (peak) runnerUp = Math.max(runnerUp, v);
    }
  }
  const at = (dx: number, dy: number) =>
    Math.abs(dx) > maxShift || Math.abs(dy) > maxShift ? null : scores[(dy + maxShift) * size + dx + maxShift];
  const refine = (m: number | null, c: number, p: number | null) => {
    if (m === null || p === null) return 0;
    const d = m - 2 * c + p;
    return d < 0 ? Math.max(-0.5, Math.min(0.5, (m - p) / (2 * d))) : 0;
  };
  return {
    dx: best.dx + refine(at(best.dx - 1, best.dy), best.score, at(best.dx + 1, best.dy)),
    dy: best.dy + refine(at(best.dx, best.dy - 1), best.score, at(best.dx, best.dy + 1)),
    score: best.score,
    margin: best.score - runnerUp,
  };
}

/** A match good enough to trust: well correlated, and clearly better than any other shift. */
export function trustworthy(s: Shift) {
  return s.score >= 0.45 && s.margin >= 0.06;
}
