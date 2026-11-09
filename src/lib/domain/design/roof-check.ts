/**
 * What is already on a roof, found on the designer's own picture before it designs (9 Nov 2026, Martin: Design it
 * for me laid panels over a home's existing ones; Google's roof data was from 2018 and knew nothing of them):
 * existing panels, vents, skylights and the like, as boxes on the picture (the partner portal's obstruction check,
 * `obstructions.ts`), turned into places on the roof to keep clear, in the designer's metres. Pure, tested.
 *
 * A helper, never a site inspection: what the picture shows on the day it was taken.
 */
import { OBSTRUCTION_SETBACK_M, type Obstruction, type ObstructionType } from "../obstructions";
import { ROOF_IMAGE, metresPerPixel, type Point } from "./roof-design";

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

/** What was found, set on the roof. */
export function roofThings(items: readonly Obstruction[], lat: number): RoofThing[] {
  return items.map((o) => ({ type: o.type, ...(o.note ? { note: o.note } : {}), box: boxOnRoof(o.box, lat) }));
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
