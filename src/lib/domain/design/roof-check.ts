/**
 * What is already on a roof, found on the designer's own picture before it designs (9 Nov 2026, Martin: Design it
 * for me laid panels over a home's existing ones; Google's roof data was from 2018 and knew nothing of them):
 * existing panels, vents, skylights and the like, as boxes on the picture (the partner portal's obstruction check,
 * `obstructions.ts`), turned into places on the roof to keep clear, in the designer's metres. Pure, tested.
 *
 * A helper, never a site inspection: what the picture shows on the day it was taken.
 */
import { OBSTRUCTION_SETBACK_M, type Obstruction, type ObstructionType } from "../obstructions";
import { ROOF_IMAGE, inside, metresPerPixel, type Point } from "./roof-design";

/** One thing found, with the place it covers on the roof (metres east and south of the picture's middle). */
export interface RoofThing {
  type: ObstructionType;
  note?: string;
  /** Its box on the roof, corners clockwise from the top left. */
  box: Point[];
}

export interface RoofCheck {
  things: RoofThing[];
  /** The checker's one line on the roof. */
  summary: string;
  /**
   * What stands in the roof's outline but isn't the home's own solid roof (10 Nov 2026, Martin: at 29 Shearer Drive
   * a pergola and the clear roof over the side path were traced as roof faces and panels laid on them): pergolas,
   * verandas, carports, glass or clear roofs, shade sails, sheds, a neighbour's house that touches this one.
   */
  notRoof?: RoofThing[];
  /** The picture it was found on: "google", or a Nearmap capture's survey. */
  picture: string;
  checkedAt: string;
}

/**
 * The part of the picture the home's roof is in, on the check's 0–1000 scale: the middle of the picture, where the
 * address is, about 30 m across and 26 m down at Melbourne's latitude.
 */
export const HOME_BOX: [number, number, number, number] = [300, 220, 700, 780];

/** A box found on the whole picture (0–1000 on each axis) as a place on the roof, in metres. */
export function boxOnRoof(box: [number, number, number, number], lat: number): Point[] {
  const mpp = metresPerPixel(lat);
  const w = ROOF_IMAGE.width * mpp;
  const h = ROOF_IMAGE.height * mpp;
  const [x0, y0, x1, y1] = [(box[0] / 1000 - 0.5) * w, (box[1] / 1000 - 0.5) * h, (box[2] / 1000 - 0.5) * w, (box[3] / 1000 - 0.5) * h];
  return [
    { x: x0, y: y0 },
    { x: x1, y: y0 },
    { x: x1, y: y1 },
    { x: x0, y: y1 },
  ];
}

/**
 * The biggest "something else" kept clear of, square metres: past it, a box is a pergola, a glass roof or a whole
 * part of the roof read as one thing, not a fixture, and would rule out roof that may be used (9 Nov 2026).
 */
export const MAX_OTHER_M2 = 6;

const boxArea = (box: Point[]) => {
  const xs = box.map((p) => p.x);
  const ys = box.map((p) => p.y);
  return (Math.max(...xs) - Math.min(...xs)) * (Math.max(...ys) - Math.min(...ys));
};

/** What was found, set on the roof (a large "something else" left out: `MAX_OTHER_M2`). */
export function roofThings(items: readonly Obstruction[], lat: number): RoofThing[] {
  return items
    .map((o): RoofThing => ({ type: o.type, ...(o.note ? { note: o.note } : {}), box: boxOnRoof(o.box, lat) }))
    .filter((t) => t.type !== "other" || boxArea(t.box) <= MAX_OTHER_M2);
}

/** Each thing's box grown by the clearance kept round it, as the places the packer keeps clear. */
export function keepOuts(things: readonly RoofThing[], clearance = OBSTRUCTION_SETBACK_M): Point[][] {
  return things.map((t) => {
    const xs = t.box.map((p) => p.x);
    const ys = t.box.map((p) => p.y);
    const [x0, x1, y0, y1] = [
      Math.min(...xs) - clearance,
      Math.max(...xs) + clearance,
      Math.min(...ys) - clearance,
      Math.max(...ys) + clearance,
    ];
    return [
      { x: x0, y: y0 },
      { x: x1, y: y0 },
      { x: x1, y: y1 },
      { x: x0, y: y1 },
    ];
  });
}

/** The structures that aren't the home's roof, from the check's boxes on the whole picture (0–1000), in metres. */
export function notRoofThings(items: readonly { box: [number, number, number, number]; note?: string }[], lat: number): RoofThing[] {
  return items.map((o) => ({ type: "other", ...(o.note ? { note: o.note } : {}), box: boxOnRoof(o.box, lat) }));
}

/** Everything panels laid by rule keep off: each thing with its clearance, and each structure that isn't roof. */
export function avoidFor(check: Pick<RoofCheck, "things" | "notRoof">): Point[][] {
  return [...keepOuts(check.things), ...(check.notRoof ?? []).map((t) => t.box)];
}

/** The share of an outline (by a grid of points over it) that falls in any of the boxes. */
function shareIn(points: Point[], boxes: Point[][]): number {
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  let on = 0;
  let all = 0;
  for (let x = Math.min(...xs); x <= Math.max(...xs); x += 0.25)
    for (let y = Math.min(...ys); y <= Math.max(...ys); y += 0.25) {
      if (!inside({ x, y }, points)) continue;
      all++;
      if (boxes.some((b) => inside({ x, y }, b))) on++;
    }
  return all ? on / all : 0;
}

/** A face read from the heights is left out when at least this share of it is over a structure that isn't roof. */
export const NOT_ROOF_SHARE = 0.5;

/** The faces that are the home's roof: those mostly over a pergola, a clear roof or the house next door left out. */
export function roofFacesOnly<T extends { points: Point[] }>(faces: T[], notRoof: readonly RoofThing[] | undefined): T[] {
  if (!notRoof?.length) return faces;
  const boxes = notRoof.map((t) => t.box);
  return faces.filter((f) => shareIn(f.points, boxes) < NOT_ROOF_SHARE);
}

/** What was left out as not the home's roof, in a sentence, or null. */
export function notRoofWords(notRoof: readonly RoofThing[] | undefined): string | null {
  const notes = [...new Set((notRoof ?? []).map((t) => (t.note ?? "").trim().toLowerCase()).filter(Boolean))].slice(0, 3);
  if (!notRoof?.length) return null;
  return notes.length
    ? `Left off what isn't the home's roof: ${notes.join("; ")}.`
    : "Left off what isn't the home's roof, as the picture shows it.";
}

/** Whether the home has panels on it already: then it is likely a battery or an expansion, not a new system. */
export const hasSolar = (things: readonly RoofThing[]) => things.some((t) => t.type === "existing panels");

const NAMES: Partial<Record<ObstructionType, [string, string]>> = {
  "existing panels": ["the existing panels", "the existing panels"],
  vent: ["a vent", "vents"],
  skylight: ["a skylight", "skylights"],
  chimney: ["a chimney", "chimneys"],
  aerial: ["an aerial", "aerials"],
  "satellite dish": ["a satellite dish", "satellite dishes"],
  "air conditioner": ["an air conditioner", "air conditioners"],
  "solar hot water": ["solar hot water", "solar hot water"],
  "tree shade": ["overhanging trees", "overhanging trees"],
  other: ["something else on the roof", "other things on the roof"],
};

/** What was kept clear of, in a sentence ("Kept clear of the existing panels, 3 vents and a skylight."), or null. */
export function keptClearWords(things: readonly RoofThing[]): string | null {
  if (!things.length) return null;
  const counts = new Map<ObstructionType, number>();
  for (const t of things) counts.set(t.type, (counts.get(t.type) ?? 0) + 1);
  const parts = [...counts].map(([type, n]) => {
    const [one, many] = NAMES[type] ?? NAMES.other!;
    return n === 1 || type === "existing panels" || type === "solar hot water" || type === "tree shade"
      ? n === 1
        ? one
        : many
      : `${n} ${many}`;
  });
  const list = parts.length > 1 ? `${parts.slice(0, -1).join(", ")} and ${parts.at(-1)}` : parts[0];
  return `Kept clear of ${list}, as the picture shows them: check on site.`;
}

/** The line a design from a home with panels already carries. */
export const HAS_SOLAR_NOTE =
  "This home already has panels. New panels are kept clear of them: it may be a battery or an addition to the system there, so ask on the call.";

/** The few words drawn beside a thing on the picture: its kind, or for anything else the start of what was seen. */
export function thingLabel(t: RoofThing): string {
  if (t.type === "other") {
    const words = (t.note ?? "").split(/\s+/).filter(Boolean).slice(0, 3).join(" ");
    return words ? words[0].toUpperCase() + words.slice(1) : "Keep clear";
  }
  return t.type[0].toUpperCase() + t.type.slice(1);
}

/** The things to keep clear of with the panels already there left out: they are being replaced (9 Nov 2026, Martin). */
export const withoutExisting = (things: readonly RoofThing[]) => things.filter((t) => t.type !== "existing panels");

/** What a design laid over the existing panels says. */
export const REPLACING_NOTE = "Laid over the existing panels, as they're being replaced: check what is coming off on site.";
