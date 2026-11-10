/**
 * The home's roof pitch, read from the faces found in the heights round it (10 Nov 2026, Martin: "can Nearmap tell us
 * the roof pitch angle, rather than guessing?"). A house's main roof is mostly at one pitch, with a garage, a verandah
 * or a patio at others: so the faces are gathered by pitch and the pitch holding the most roof is the home's. It is a
 * measure from a height survey, never a site measure: it comes with how much of the roof agreed, and anything thin is
 * offered to check rather than set. Pure, tested.
 */
import { ASPECT } from "./face-aspect";

export const ROOF_PITCH = {
  /** Faces within this many degrees of each other are the same pitch. */
  alike: 3,
  /** The least roof, in square metres from above, a reading may rest on. */
  minArea: 25,
  /** The share of the roof read that must be at the pitch for it to be set without asking. */
  sureShare: 0.55,
  /** The steepest pitch believed: past it the heights are reading a wall or a tree. */
  steepest: 50,
} as const;

/** What the reading needs of a face: its pitch in degrees and its size from above. */
export interface PitchFace {
  pitch: number;
  areaM2: number;
}

export interface PitchReading {
  /** Whole degrees; 0 for a flat roof. */
  pitch: number;
  /** The roof reads as flat (under `ASPECT.flatBelow`). */
  flat: boolean;
  /** How many faces are at this pitch, and how many were read in all. */
  faces: number;
  of: number;
  /** The share of the roof read that is at this pitch, 0 to 1. */
  share: number;
  /** Enough of the roof agrees for it to be set without asking. */
  sure: boolean;
}

/**
 * The pitch most of the roof is at, or null when too little roof was read to say. Faces steeper than a roof can be are
 * left out. Each face gathers those within `alike` degrees of it; the gathering holding the most roof wins, and its
 * pitch is the mean of its faces by their size.
 */
export function pitchOfRoof(found: readonly PitchFace[]): PitchReading | null {
  const faces = found.filter(
    (f) => Number.isFinite(f.pitch) && Number.isFinite(f.areaM2) && f.areaM2 > 0 && f.pitch >= 0 && f.pitch <= ROOF_PITCH.steepest,
  );
  const total = faces.reduce((sum, f) => sum + f.areaM2, 0);
  if (total < ROOF_PITCH.minArea) return null;
  let best: { area: number; pitch: number; count: number } | null = null;
  for (const face of faces) {
    const group = faces.filter((f) => Math.abs(f.pitch - face.pitch) <= ROOF_PITCH.alike);
    const area = group.reduce((sum, f) => sum + f.areaM2, 0);
    if (best && area <= best.area) continue;
    best = { area, pitch: group.reduce((sum, f) => sum + f.pitch * f.areaM2, 0) / area, count: group.length };
  }
  if (!best) return null;
  const flat = best.pitch < ASPECT.flatBelow;
  const share = best.area / total;
  return {
    pitch: flat ? 0 : Math.round(best.pitch),
    flat,
    faces: best.count,
    of: faces.length,
    share: Math.round(share * 100) / 100,
    sure: share >= ROOF_PITCH.sureShare && best.area >= ROOF_PITCH.minArea,
  };
}

/** The reading in a line, for beside the pitch: what was read, from what, and to check it. */
export function pitchReadWords(read: PitchReading, source: string, captured: string | null): string {
  const what = read.flat ? "The roof reads as flat" : `The roof reads ${read.pitch}°`;
  const from = `${source}${captured ? ` (${captured})` : ""}`;
  const how =
    read.of <= 1
      ? "one roof face"
      : read.faces === read.of
        ? `all ${read.of} roof faces`
        : `${read.faces} of ${read.of} roof faces, ${Math.round(read.share * 100)}% of the roof`;
  return `${what} from ${from}: ${how}. Measured from a height survey, not on site: check it.`;
}

/** Said when the heights can't give a pitch. */
export const PITCH_NOT_READ = "The heights here don't show the roof clearly enough to read its pitch. Set it by hand.";
