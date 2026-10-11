/**
 * "Suggest a layout": a first set of panels for a roof, from Google's roof
 * model (every spot a panel fits, with each roof face's direction and pitch).
 * The spots are chosen by `autoLayout` (tidy groups on as few faces as
 * possible) and set down as panels placed by hand, so each can be moved,
 * turned or taken out like any other. Pure, tested.
 *
 * Google's spots are for its own reference panel, seen from above (so they
 * sit closer together down a slope than the panel is long). Ours are redrawn
 * as a tidy block: each group keeps its rows and columns and its place on the
 * roof, and is laid out again at our panel's size and gap, the way the
 * designer draws its own rows. It is a starting point to check against the
 * picture, never a finished design: it knows nothing of vents, skylights or
 * setbacks.
 */
import { autoLayout, type RoofModel } from "../roof-layout";
import type { LoosePanel, PanelSize } from "./roof-design";
import { TILT } from "./tilt";

/** The most panels a suggestion lays out. */
export const MAX_SUGGESTED = 60;

const cm = (n: number) => Math.round(n * 100) / 100;

export function suggestPanels(
  model: RoofModel,
  /** The middle of the picture: panels are placed in metres from it. */
  centre: { lat: number; lng: number },
  count: number,
  size: PanelSize,
  newId: () => string,
): LoosePanel[] {
  const chosen = autoLayout(model, Math.min(MAX_SUGGESTED, Math.max(0, Math.round(count))));
  const mLat = 111_132.954 - 559.822 * Math.cos((2 * centre.lat * Math.PI) / 180);
  const mLng = 111_412.84 * Math.cos((centre.lat * Math.PI) / 180);
  // A group is the chosen spots on one face laid the same way up.
  const groups = new Map<string, number[]>();
  for (const i of chosen) {
    const s = model.slots[i];
    const key = `${s.segment}:${s.orientation}`;
    groups.set(key, [...(groups.get(key) ?? []), i]);
  }
  const out: LoosePanel[] = [];
  for (const members of groups.values()) {
    const first = model.slots[members[0]];
    const face = model.faces[first.segment] ?? { azimuth: 0, pitch: 0 };
    const portrait = first.orientation === "PORTRAIT";
    const t = (face.azimuth * Math.PI) / 180;
    // On the ground, in metres east and south: "down" the slope (the way the face looks), and across it.
    const down = { x: Math.sin(t), y: -Math.cos(t) };
    const side = { x: Math.cos(t), y: Math.sin(t) };
    const at = members.map((i) => {
      const s = model.slots[i];
      const x = (s.lng - centre.lng) * mLng;
      const y = -(s.lat - centre.lat) * mLat;
      return { a: x * down.x + y * down.y, b: x * side.x + y * side.y };
    });
    // Google's spacing between neighbours, as seen from above: its panel foreshortened down the slope.
    const stepDown = (portrait ? model.panel.heightM : model.panel.widthM) * Math.cos((face.pitch * Math.PI) / 180);
    const stepSide = portrait ? model.panel.widthM : model.panel.heightM;
    // Ours: the same rows and columns about the same middle, at our panel's size with the usual gap.
    const ourDown = (portrait ? size.long : size.short) + size.gap;
    const ourSide = (portrait ? size.short : size.long) + size.gap;
    const tilt = Math.max(0, Math.min(TILT.max, Math.round(face.pitch)));
    const azimuth = ((Math.round(face.azimuth) % 360) + 360) % 360;
    // Rows and columns are counted from the block's first row and column (counting from its middle would split
    // a block with an even number of rows on a rounding error), and the block is then centred where Google's was.
    const minA = Math.min(...at.map((p) => p.a));
    const minB = Math.min(...at.map((p) => p.b));
    const cells = at.map((p) => ({ row: Math.round((p.a - minA) / (stepDown || 1)), col: Math.round((p.b - minB) / (stepSide || 1)) }));
    const midRow = Math.max(...cells.map((c) => c.row)) / 2;
    const midCol = Math.max(...cells.map((c) => c.col)) / 2;
    const centreA = (minA + Math.max(...at.map((p) => p.a))) / 2;
    const centreB = (minB + Math.max(...at.map((p) => p.b))) / 2;
    const taken = new Set<string>();
    for (const { row, col } of cells) {
      // Two spots that round to the same place would stack: the second is left out.
      if (taken.has(`${row}:${col}`)) continue;
      taken.add(`${row}:${col}`);
      const a = centreA + (row - midRow) * ourDown;
      const b = centreB + (col - midCol) * ourSide;
      out.push({
        id: newId(),
        x: cm(a * down.x + b * side.x),
        y: cm(a * down.y + b * side.y),
        // A panel faces along its long edge; one on its side faces a quarter turn on from it.
        angle: portrait ? azimuth : (azimuth + 270) % 360,
        ...(portrait ? {} : { across: true }),
        tilt,
      });
    }
  }
  return out;
}
