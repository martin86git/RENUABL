/**
 * Roof obstructions found on the satellite image (vents, skylights, aerials,
 * existing panels, shade from trees), as boxes on the image. Panels that
 * overlap one (with a small setback) are flagged for the partner to move.
 * Pure and tested. The check is a helper: the partner confirms on site.
 */
import { fromPixel, metresPerPixel, panelOutline, project, type ImageFrame, type MapView, type RoofModel } from "./roof-layout";

export const OBSTRUCTION_TYPES = [
  "vent",
  "skylight",
  "chimney",
  "aerial",
  "satellite dish",
  "air conditioner",
  "solar hot water",
  "existing panels",
  "tree shade",
  "other",
] as const;
export type ObstructionType = (typeof OBSTRUCTION_TYPES)[number];

export interface Obstruction {
  type: ObstructionType;
  /** Box on the image, 0–1000 on each axis (left, top, right, bottom). */
  box: [number, number, number, number];
  note?: string;
}

export interface ObstructionCheck {
  items: Obstruction[];
  summary: string;
  checkedAt: string;
}

/** Clearance kept around an obstruction, metres. */
export const OBSTRUCTION_SETBACK_M = 0.3;

const clamp = (n: number) => Math.max(0, Math.min(1000, Math.round(n)));

/** The check's answer, cleaned: known types, boxes the right way round, at most 30. */
export function cleanObstructions(raw: unknown): Obstruction[] {
  const list = (raw as { obstructions?: unknown } | null)?.obstructions;
  if (!Array.isArray(list)) return [];
  const out: Obstruction[] = [];
  for (const o of list.slice(0, 30)) {
    const r = (o ?? {}) as Record<string, unknown>;
    const type = OBSTRUCTION_TYPES.includes(r.type as ObstructionType) ? (r.type as ObstructionType) : "other";
    const b = Array.isArray(r.box) ? r.box.map(Number) : [];
    if (b.length !== 4 || b.some((n) => !Number.isFinite(n))) continue;
    const [x0, y0, x1, y1] = [
      clamp(Math.min(b[0], b[2])),
      clamp(Math.min(b[1], b[3])),
      clamp(Math.max(b[0], b[2])),
      clamp(Math.max(b[1], b[3])),
    ];
    if (x1 - x0 < 1 || y1 - y0 < 1) continue;
    const note = typeof r.note === "string" ? r.note.replace(/[<>]/g, "").slice(0, 80) : undefined;
    out.push({ type, box: [x0, y0, x1, y1], ...(note ? { note } : {}) });
  }
  return out;
}

/** An obstruction's box in image pixels. */
export function boxPixels(o: Obstruction, view: MapView) {
  const full = view.size * view.scale;
  const [x0, y0, x1, y1] = o.box.map((n) => (n / 1000) * full);
  return { x0, y0, x1, y1 };
}

/** An obstruction's box (found on the Maps Static image) drawn on another image, e.g. Google Solar's photo. */
export function boxOnFrame(o: Obstruction, view: MapView, frame: ImageFrame) {
  const b = boxPixels(o, view);
  const pts = [fromPixel(b.x0, b.y0, view), fromPixel(b.x1, b.y0, view), fromPixel(b.x1, b.y1, view), fromPixel(b.x0, b.y1, view)].map(
    (p) => project(p.lat, p.lng, frame),
  );
  const xs = pts.map((p) => p.x);
  const ys = pts.map((p) => p.y);
  return { x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys) };
}

/** Panel spots (indexes) that overlap an obstruction, allowing the setback. */
export function blockedSlots(model: RoofModel, view: MapView, items: Obstruction[]): number[] {
  const pad = OBSTRUCTION_SETBACK_M / metresPerPixel(view);
  const boxes = items.map((o) => boxPixels(o, view));
  const out: number[] = [];
  model.slots.forEach((slot, i) => {
    const pts = panelOutline(slot, model, view);
    const xs = pts.map((p) => p.x);
    const ys = pts.map((p) => p.y);
    const [px0, px1, py0, py1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
    if (boxes.some((b) => px0 < b.x1 + pad && px1 > b.x0 - pad && py0 < b.y1 + pad && py1 > b.y0 - pad)) out.push(i);
  });
  return out;
}
