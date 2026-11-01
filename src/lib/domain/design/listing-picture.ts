/**
 * The roof design on a job listing (1 Nov 2026, Martin: "the job listings need to have images of the actual design...
 * just blur out anything around it that might give an indication of more information about the home"). The picture
 * is the satellite photo with the panel layout over it, cropped close on the panels, and everything but the roof
 * itself blurred past recognition: neighbours, the street, the yard, the car in the drive. The roof is the traced
 * faces the panels sit on, or, with none traced, a little past the panels. Drawn once on the server when the job is
 * listed and kept with the listing (nothing from a browser); without a photo it is the panels on a plain ground.
 * Pure, tested: the shapes and the SVG; the blurring itself is server/design-listing-picture.ts.
 */
import { jobDrawing, type JobDrawing } from "./job-card";
import { designPanels, metresPerPixel, ROOF_IMAGE, type Point, type RoofDesign } from "./roof-design";

type Px = { x: number; y: number };

/** How far past the panels the sharp part reaches when no roof face is traced, in metres. */
export const ROOF_MARGIN_M = 0.8;

const r1 = (n: number) => Math.round(n * 10) / 10;

function inside(p: Px, poly: readonly Px[]): boolean {
  let hit = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i];
    const b = poly[j];
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) hit = !hit;
  }
  return hit;
}

/** The convex hull of some points (monotone chain), clockwise on screen. */
export function hull(points: readonly Px[]): Px[] {
  const pts = [...points].sort((a, b) => a.x - b.x || a.y - b.y);
  if (pts.length < 3) return pts;
  const cross = (o: Px, a: Px, b: Px) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
  const lower: Px[] = [];
  for (const p of pts) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop();
    lower.push(p);
  }
  const upper: Px[] = [];
  for (const p of [...pts].reverse()) {
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop();
    upper.push(p);
  }
  return [...lower.slice(0, -1), ...upper.slice(0, -1)];
}

/** A shape pushed out from its middle by some pixels: enough for the panels' edges to sit in the sharp part. */
function grow(poly: readonly Px[], by: number): Px[] {
  const c = { x: poly.reduce((n, p) => n + p.x, 0) / poly.length, y: poly.reduce((n, p) => n + p.y, 0) / poly.length };
  return poly.map((p) => {
    const d = Math.hypot(p.x - c.x, p.y - c.y) || 1;
    return { x: p.x + ((p.x - c.x) / d) * by, y: p.y + ((p.y - c.y) / d) * by };
  });
}

/**
 * The part of the picture left sharp, in the picture's pixels: each traced roof face holding a panel; with none
 * traced (panels placed in the open, or Google's roof model), the outline round each group of panels a little past
 * them. Null when the design has no panels.
 */
export function roofClip(design: RoofDesign): Px[][] | null {
  const panels = designPanels(design);
  if (!panels.length) return null;
  const scale = metresPerPixel(design.lat);
  const px = (p: Point): Px => ({ x: ROOF_IMAGE.width / 2 + p.x / scale, y: ROOF_IMAGE.height / 2 + p.y / scale });
  const shapes = panels.map((p) => p.corners.map(px));
  const middles = shapes.map((s) => ({ x: s.reduce((n, p) => n + p.x, 0) / s.length, y: s.reduce((n, p) => n + p.y, 0) / s.length }));
  const faces = design.faces.map((f) => f.points.map(px)).filter((f) => f.length >= 3);
  const holding = faces.filter((f) => middles.some((m) => inside(m, f)));
  const loose = shapes.filter((_, i) => !holding.some((f) => inside(middles[i], f)));
  const margin = ROOF_MARGIN_M / scale;
  return [...holding.map((f) => grow(f, margin / 2)), ...(loose.length ? [grow(hull(loose.flat()), margin)] : [])];
}

/** The listing's drawing: the layout (panels, and INV, BAT, MSB where the design puts them), and the sharp part. */
export function listingDrawing(design: RoofDesign): { drawing: JobDrawing; clip: Px[][] } | null {
  const drawing = jobDrawing(design, "layout");
  const clip = roofClip(design);
  return drawing && clip ? { drawing: { ...drawing, viewBox: framed(drawing.viewBox) }, clip } : null;
}

/** The listing's shape, 4:3 like its card: the crop round the panels widened (the extra is blurred), kept on the photo. */
export const LISTING_ASPECT = 4 / 3;
const MIN_WIDTH = 240;

function framed(viewBox: string): string {
  const [x, y, w, h] = viewBox.split(" ").map(Number);
  let W = Math.max(w, h * LISTING_ASPECT, MIN_WIDTH);
  let H = W / LISTING_ASPECT;
  if (H > ROOF_IMAGE.height) {
    H = ROOF_IMAGE.height;
    W = H * LISTING_ASPECT;
  }
  const cx = x + w / 2;
  const cy = y + h / 2;
  const left = Math.min(Math.max(0, cx - W / 2), ROOF_IMAGE.width - W);
  const top = Math.min(Math.max(0, cy - H / 2), ROOF_IMAGE.height - H);
  return [left, top, W, H].map(r1).join(" ");
}

const points = (poly: readonly Px[]) => poly.map((p) => `${r1(p.x)},${r1(p.y)}`).join(" ");

/**
 * The picture as an SVG at twice the drawing's size: the blurred, darkened photo everywhere; the sharp photo only
 * inside the roof; a fine line round the roof; the panels over it. `blurred` and `sharp` are data URLs of the same
 * photo (640 × 400 in the picture's units), or null each, and then the roof is drawn on a plain ground.
 */
export function listingPictureSvg(input: { drawing: JobDrawing; clip: Px[][]; sharp: string | null; blurred: string | null }): string {
  const { drawing, clip, sharp, blurred } = input;
  const [x, y, w, h] = drawing.viewBox.split(" ").map(Number);
  const W = ROOF_IMAGE.width;
  const H = ROOF_IMAGE.height;
  const image = (href: string, extra = "") =>
    `<image href="${href}" x="0" y="0" width="${W}" height="${H}" preserveAspectRatio="none"${extra}/>`;
  const roof = clip.map((poly) => `<polygon points="${points(poly)}"/>`).join("");
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${Math.round(w * 2)}" height="${Math.round(h * 2)}" viewBox="${drawing.viewBox}">`,
    `<defs><clipPath id="roof">${roof}</clipPath></defs>`,
    `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#2a2d31"/>`,
    blurred ? `${image(blurred)}<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#0b0b0c" fill-opacity="0.38"/>` : "",
    sharp
      ? image(sharp, ` clip-path="url(#roof)"`)
      : `<g fill="#5b6067">${clip.map((poly) => `<polygon points="${points(poly)}"/>`).join("")}</g>`,
    `<g fill="none" stroke="#ffffff" stroke-opacity="0.55" stroke-width="0.6">${roof}</g>`,
    drawing.marks,
    `</svg>`,
  ].join("");
}
