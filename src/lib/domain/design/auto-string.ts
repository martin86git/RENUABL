/**
 * "String the panels for me" in the roof designer: the panels on a design
 * wired into strings and put on the inverter's inputs, by rule, the same every
 * time. Pure, tested.
 *
 * The rules:
 *  - panels are grouped by how they sit (the same tilt, and the same direction
 *    within a few degrees), and a string never takes panels from two groups:
 *    one string, one direction;
 *  - how long a string may be comes from the inverter's own limits in
 *    `electrical.ts`, through `checkString`: no longer than keeps the coldest
 *    morning's voltage under its maximum and the coldest working voltage inside
 *    its tracking range, no shorter than keeps the hottest afternoon's working
 *    voltage in that range and can still start it;
 *  - each group is split into as few strings as fit, as near the same length as
 *    can be, one string to an input while there are inputs to spare (keeping one
 *    back for every group still to come), and two on one input only when they
 *    are the same length and direction and the input's current allows it;
 *  - along a string the panels are joined row by row, turning back at the end
 *    of each row (a snake), so the wiring stays short;
 *  - every string is then checked with `checkString`.
 *
 * It never pretends: a panel or inverter whose details aren't on file gets no
 * strings, only a note saying so; panels that can't be strung are left and
 * named. Every electrical figure behind it is a VERIFY item, and the result is
 * a starting point for the installer's own design check, not a substitute.
 */
import { checkString, type InverterElectrical, type PanelElectrical, type StringCheck } from "./electrical";
import { ARRAY_GAP, designPanels, panelAspects, panelGap, type Layout, type PanelString } from "./roof-design";

/** A panel to be strung: its name in the design, its centre in metres (x to the east, y to the south), how it sits. */
export interface AutoPanel {
  key: string;
  x: number;
  y: number;
  /** Degrees up from flat. */
  tilt: number;
  /** The direction it looks, degrees clockwise from north. */
  facing: number;
  /** Which array it is in (panels touching), when known: a string finishes one array before it starts the next. */
  array?: string;
}

export interface AutoStringInverter {
  electrical?: InverterElectrical;
  /** Its name, to say which one isn't on file. */
  name?: string;
}

export interface AutoStringResult {
  strings: PanelString[];
  /** The check of each string, in the same order. */
  checks: StringCheck[];
  /** Panels that aren't in any string. */
  left: string[];
  /** What was done, and why anything was left, in plain words. */
  note: string;
  /** Strings were made and none of them is outside the limits. */
  ok: boolean;
}

/** Panels whose tilts differ by this many degrees or fewer count as sitting the same way. */
export const TILT_TOLERANCE = 3;
/** And whose directions differ by this many degrees or fewer. */
export const FACING_TOLERANCE = 10;
/** A panel flatter than this looks nowhere in particular: its direction doesn't separate it from others. */
const FLAT = 1;
/** Panel centres closer than this down the slope are in the same row, metres. A row is a panel deep, over a metre. */
export const ROW_TOLERANCE = 0.5;
/** The longest string tried. */
const MAX_LENGTH = 60;

const turn360 = (degrees: number) => ((degrees % 360) + 360) % 360;
const apartDegrees = (a: number, b: number) => Math.abs(((a - b + 540) % 360) - 180);
const lookOf = (p: Pick<AutoPanel, "tilt" | "facing">) => (p.tilt < FLAT ? 0 : turn360(p.facing));

/**
 * How many panels a string may have on this inverter: the shortest and longest whose voltages are inside its
 * limits on the coldest and the hottest day (the four voltage lines of `checkString`). Null when no length is.
 */
export function stringRange(panel: PanelElectrical, inverter: InverterElectrical): { min: number; max: number } | null {
  let min = 0;
  let max = 0;
  for (let n = 1; n <= MAX_LENGTH; n++) {
    // The voltage lines come first, in this order: highest, hottest working, coldest working, starting.
    const fine = checkString({ panels: n, panel, inverter, mppt: 0, sharing: 1 })
      .lines.slice(0, 4)
      .every((l) => l.ok === true);
    if (fine) {
      if (!min) min = n;
      max = n;
    } else if (min) break;
  }
  return min ? { min, max } : null;
}

/** How many strings one input may take side by side: its connectors, as far as its currents allow. 0 when not even one. */
export function inputCapacity(panel: PanelElectrical, inverter: InverterElectrical, mppt: number): number {
  const tracker = inverter.mppts[mppt];
  if (!tracker) return 0;
  let cap = 0;
  for (let k = 1; k <= tracker.strings; k++) {
    const lines = checkString({ panels: 1, panel, inverter, mppt, sharing: k }).lines;
    const isc = lines.find((l) => l.what.startsWith("Short-circuit"));
    const imp = lines.find((l) => l.what.startsWith("Working current"));
    if (isc?.ok === false) break;
    // One string a little over what an input uses is only clipped; two side by side must be within it.
    if (k > 1 && imp?.ok !== true) break;
    cap = k;
  }
  return cap;
}

/** Panels in groups that sit the same way, the largest group first (the order they came in between equals). */
export function orientationGroups(panels: AutoPanel[]): { tilt: number; facing: number; panels: AutoPanel[] }[] {
  const groups: { tilt: number; facing: number; panels: AutoPanel[] }[] = [];
  for (const p of panels) {
    const facing = lookOf(p);
    const flat = p.tilt < FLAT;
    const group = groups.find(
      (g) => Math.abs(g.tilt - p.tilt) <= TILT_TOLERANCE && g.tilt < FLAT === flat && apartDegrees(g.facing, facing) <= FACING_TOLERANCE,
    );
    if (group) group.panels.push(p);
    else groups.push({ tilt: p.tilt, facing, panels: [p] });
  }
  return groups.sort((a, b) => b.panels.length - a.panels.length);
}

/**
 * Panels in the order a string joins them: an array at a time, and in each, row by row from the top of the
 * slope, the first row from left to right (looking at the roof from below), the next back the other way.
 * `facing` is the way the panels look, degrees clockwise from north.
 */
export function snakeOrder(panels: AutoPanel[], facing: number): AutoPanel[] {
  const t = (facing * Math.PI) / 180;
  // Down the slope, and along the rows, in the picture's metres (x to the east, y to the south).
  const down = (p: AutoPanel) => p.x * Math.sin(t) - p.y * Math.cos(t);
  const along = (p: AutoPanel) => p.x * Math.cos(t) + p.y * Math.sin(t);
  const arrays = new Map<string, AutoPanel[]>();
  for (const p of panels) arrays.set(p.array ?? "", [...(arrays.get(p.array ?? "") ?? []), p]);
  const top = (list: AutoPanel[]) => Math.min(...list.map(down));
  const left = (list: AutoPanel[]) => Math.min(...list.map(along));
  const ordered = [...arrays.values()].sort((a, b) => top(a) - top(b) || left(a) - left(b));
  const out: AutoPanel[] = [];
  for (const list of ordered) {
    const sorted = [...list].sort((a, b) => down(a) - down(b) || along(a) - along(b));
    const rows: AutoPanel[][] = [];
    for (const p of sorted) {
      const row = rows[rows.length - 1];
      if (row && down(p) - down(row[0]) <= ROW_TOLERANCE) row.push(p);
      else rows.push([p]);
    }
    rows.forEach((row, i) => {
      row.sort((a, b) => along(a) - along(b));
      out.push(...(i % 2 ? row.reverse() : row));
    });
  }
  return out;
}

interface Input {
  inverter: number;
  mppt: number;
  cap: number;
  range: { min: number; max: number };
}

interface Placed {
  input: Input;
  length: number;
  count: number;
}

/** Strings of these lengths onto free inputs: a new input for each while `limit` allows, else beside one of its own length. */
function pack(lengths: number[], inputs: Input[], limit: number): Placed[] | null {
  const placed: Placed[] = [];
  for (const length of lengths) {
    const fits = (i: Input) => length >= i.range.min && length <= i.range.max;
    const fresh = placed.length < limit ? inputs.find((i) => fits(i) && !placed.some((p) => p.input === i)) : undefined;
    if (fresh) {
      placed.push({ input: fresh, length, count: 1 });
      continue;
    }
    const beside = placed.find((p) => p.length === length && p.count < p.input.cap);
    if (!beside) return null;
    beside.count++;
  }
  return placed;
}

/** The most of `n` panels that can be strung on these inputs, in as few strings as can be, near the same length. */
function planGroup(n: number, inputs: Input[], limit: number): Placed[] | null {
  const most = inputs.reduce((sum, i) => sum + i.cap, 0);
  for (let m = n; m >= 1; m--)
    for (let s = 1; s <= most; s++) {
      const q = Math.floor(m / s);
      if (q < 1) break;
      const r = m % s;
      const lengths = [...Array<number>(r).fill(q + 1), ...Array<number>(s - r).fill(q)];
      const placed = pack(lengths, inputs, limit);
      if (placed) return placed;
    }
  return null;
}

/** The closest any panel of one set comes to any of another, metres. */
const gapBetween = (a: AutoPanel[], b: AutoPanel[]) => Math.min(...a.flatMap((p) => b.map((q) => Math.hypot(p.x - q.x, p.y - q.y))));

/**
 * A group's panels (already in snake order, an array at a time) as clusters a string may be drawn from: each array its
 * own (8 Nov 2026, Martin: a string that ran from the big array into two small ones meant cable across the roof), with
 * any too small for a string of its own (`shortest`) joined to the nearest. Each keeps the snake's order.
 */
export function arrayClusters(panels: AutoPanel[], shortest: number): AutoPanel[][] {
  const at = new Map(panels.map((p, i) => [p.key, i]));
  const order = (list: AutoPanel[]) => [...list].sort((a, b) => (at.get(a.key) ?? 0) - (at.get(b.key) ?? 0));
  let clusters: AutoPanel[][] = [];
  for (const p of panels) {
    const last = clusters[clusters.length - 1];
    if (last && (last[0].array ?? "") === (p.array ?? "")) last.push(p);
    else clusters.push([p]);
  }
  for (;;) {
    const small = clusters.findIndex((c) => c.length < shortest);
    if (small < 0 || clusters.length < 2) return clusters;
    let near = -1;
    let gap = Infinity;
    clusters.forEach((c, i) => {
      if (i === small) return;
      const d = gapBetween(clusters[small], c);
      if (d < gap) [near, gap] = [i, d];
    });
    const joined = order([...clusters[small], ...clusters[near]]);
    clusters = clusters.filter((_, i) => i !== small && i !== near);
    clusters.push(joined);
    clusters.sort((a, b) => (at.get(a[0].key) ?? 0) - (at.get(b[0].key) ?? 0));
  }
}

/** The clusters with the two closest joined into one: used when the clusters as they are don't fit the inputs. */
function joinClosest(clusters: AutoPanel[][], panels: AutoPanel[]): AutoPanel[][] {
  const at = new Map(panels.map((p, i) => [p.key, i]));
  let best: [number, number] = [0, 1];
  let gap = Infinity;
  for (let i = 0; i < clusters.length; i++)
    for (let j = i + 1; j < clusters.length; j++) {
      const d = gapBetween(clusters[i], clusters[j]);
      if (d < gap) [best, gap] = [[i, j], d];
    }
  const joined = [...clusters[best[0]], ...clusters[best[1]]].sort((a, b) => (at.get(a.key) ?? 0) - (at.get(b.key) ?? 0));
  return [...clusters.filter((_, i) => i !== best[0] && i !== best[1]), joined].sort(
    (a, b) => (at.get(a[0].key) ?? 0) - (at.get(b[0].key) ?? 0),
  );
}

/** Every cluster strung whole on its own inputs, or null when they don't all fit (`waiting`: inputs kept for later groups). */
function planClusters(clusters: AutoPanel[][], open: Input[], waiting: number): { panels: AutoPanel[]; plan: Placed[] }[] | null {
  const used = new Set<Input>();
  const out: { panels: AutoPanel[]; plan: Placed[] }[] = [];
  for (let ci = 0; ci < clusters.length; ci++) {
    const avail = open.filter((i) => !used.has(i));
    const limit = avail.length - (clusters.length - 1 - ci) - waiting;
    if (limit < 1) return null;
    const plan = planGroup(clusters[ci].length, avail, limit);
    if (!plan || plan.reduce((sum, p) => sum + p.length * p.count, 0) !== clusters[ci].length) return null;
    for (const p of plan) used.add(p.input);
    out.push({ panels: clusters[ci], plan });
  }
  return out;
}

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

const VERIFY_NOTE =
  "The panel and inverter figures behind this are from datasheets on file, each a VERIFY item: check the strings with the maker's sizing tool before relying on them.";

/** Strings for these panels on these inverters, or a note saying why not. */
export function autoString(input: {
  panels: AutoPanel[];
  inverters: AutoStringInverter[];
  panel?: PanelElectrical;
  /** The panel's name, to say which one isn't on file. */
  panelName?: string;
}): AutoStringResult {
  const { panel } = input;
  const all = input.panels.map((p) => p.key);
  const none = (note: string): AutoStringResult => ({ strings: [], checks: [], left: all, note, ok: false });
  if (!input.panels.length) return { strings: [], checks: [], left: [], note: "There are no panels on the design to string.", ok: false };
  if (!panel)
    return none(
      `${input.panelName ? `The ${input.panelName}'s` : "This panel's"} electrical details (Voc, Vmp, Isc) aren't on file, so strings can't be worked out here. String the panels by hand and check them against the datasheet.`,
    );
  if (!input.inverters.length) return none("Choose an inverter first: strings are worked out against its input limits.");
  const unknown = input.inverters.findIndex((i) => !i.electrical);
  if (unknown >= 0) {
    const which = input.inverters.length > 1 ? `Inverter ${unknown + 1}` : "The inverter";
    const name = input.inverters[unknown].name;
    return none(
      `${which}${name ? ` (${name})` : ""}'s input limits aren't on file, so strings can't be worked out against it. String the panels by hand and check them against its datasheet.`,
    );
  }

  const inputs: Input[] = [];
  input.inverters.forEach((inv, i) => {
    const e = inv.electrical as InverterElectrical;
    const range = stringRange(panel, e);
    if (!range) return;
    e.mppts.forEach((_, m) => {
      const cap = inputCapacity(panel, e, m);
      if (cap > 0) inputs.push({ inverter: i, mppt: m, cap, range });
    });
  });
  if (!inputs.length)
    return none(
      "No input on the inverter can take a string of these panels within its limits, so nothing is strung. Check the choice of inverter.",
    );

  const shortest = Math.min(...inputs.map((i) => i.range.min));
  const groups = orientationGroups(input.panels).map((g) => ({ ...g, panels: snakeOrder(g.panels, g.facing) }));
  const free = new Set(inputs);
  const strings: PanelString[] = [];
  const checks: StringCheck[] = [];
  const left: string[] = [];
  const why: string[] = [];
  groups.forEach((group, gi) => {
    const n = group.panels.length;
    const open = inputs.filter((i) => free.has(i));
    const where = groups.length > 1 ? ` facing ${Math.round(group.facing)}° at ${Math.round(group.tilt)}°` : "";
    if (!open.length) {
      left.push(...group.panels.map((p) => p.key));
      why.push(`${plural(n, "panel")}${where}: no inverter input is left for them (a string doesn't mix directions)`);
      return;
    }
    // Keep one input back for each group still to come that is big enough for a string of its own.
    const waiting = groups.slice(gi + 1).filter((g) => g.panels.length >= shortest).length;
    const emit = (panelsIn: AutoPanel[], plan: Placed[]) => {
      let at = 0;
      for (const placed of plan) {
        free.delete(placed.input);
        const e = input.inverters[placed.input.inverter].electrical as InverterElectrical;
        for (let k = 0; k < placed.count; k++) {
          const panels = panelsIn.slice(at, at + placed.length).map((p) => p.key);
          at += placed.length;
          strings.push({
            id: `s${strings.length + 1}`,
            panels,
            ...(placed.input.inverter > 0 ? { inverter: placed.input.inverter } : {}),
            mppt: placed.input.mppt,
          });
          checks.push(checkString({ panels: panels.length, panel, inverter: e, mppt: placed.input.mppt, sharing: placed.count }));
        }
      }
      return at;
    };
    // Array by array first, so no string runs from one array to another unless an array is too small for one of its
    // own, or there aren't the inputs for every array apart: then the closest are joined, one pair at a time.
    let clusters = arrayClusters(group.panels, shortest);
    let byArray = clusters.length > 1 ? planClusters(clusters, open, waiting) : null;
    while (!byArray && clusters.length > 2) {
      clusters = joinClosest(clusters, group.panels);
      byArray = planClusters(clusters, open, waiting);
    }
    if (byArray) {
      for (const c of byArray) emit(c.panels, c.plan);
      return;
    }
    const plan = planGroup(n, open, Math.max(1, open.length - waiting));
    if (!plan) {
      left.push(...group.panels.map((p) => p.key));
      const least = Math.min(...open.map((i) => i.range.min));
      why.push(
        n < least
          ? `${plural(n, "panel")}${where}: fewer than the ${least} a string needs to reach the inverter's working and starting voltage on the hottest day`
          : `${plural(n, "panel")}${where}: they don't fit the inputs left`,
      );
      return;
    }
    const at = emit(group.panels, plan);
    if (at < n) {
      left.push(...group.panels.slice(at).map((p) => p.key));
      why.push(`${plural(n - at, "panel")}${where}: more than the inputs left can take within their limits`);
    }
  });

  const several = input.inverters.length > 1;
  const sharing = new Map<string, number>();
  for (const s of strings) sharing.set(`${s.inverter ?? 0}|${s.mppt}`, (sharing.get(`${s.inverter ?? 0}|${s.mppt}`) ?? 0) + 1);
  const said = strings.map((s) => {
    const on = `${several ? `inverter ${(s.inverter ?? 0) + 1}, ` : ""}input ${(s.mppt ?? 0) + 1}`;
    return `${s.panels.length} on ${on}${(sharing.get(`${s.inverter ?? 0}|${s.mppt}`) ?? 1) > 1 ? " (side by side)" : ""}`;
  });
  const parts: string[] = [];
  if (strings.length) {
    const strung = strings.reduce((sum, s) => sum + s.panels.length, 0);
    parts.push(`${plural(strung, "panel")} in ${plural(strings.length, "string")}: ${said.join("; ")}.`);
    const ranges = [
      ...new Set(
        inputs.filter((i) => strings.some((s) => (s.inverter ?? 0) === i.inverter)).map((i) => `${i.range.min} to ${i.range.max}`),
      ),
    ];
    parts.push(
      `A string here can be ${ranges.join(" or ")} panels long, for the inverter's voltage limits on the coldest and the hottest day.`,
    );
  } else parts.push("Nothing could be strung.");
  if (left.length) parts.push(`Not strung: ${why.join("; ")}.`);
  const bad = checks.filter((c) => c.verdict === "bad").length;
  const caution = checks.filter((c) => c.verdict === "caution").length;
  if (bad) parts.push(`${plural(bad, "string")} ${bad === 1 ? "is" : "are"} outside the limits: see ${bad === 1 ? "its" : "their"} check.`);
  else if (caution)
    parts.push(`${plural(caution, "string")} ${caution === 1 ? "is" : "are"} within the limits with something to know: see the check.`);
  parts.push(VERIFY_NOTE);
  return { strings, checks, left, note: parts.join(" "), ok: strings.length > 0 && bad === 0 };
}

/** The panels of a design as `autoString` wants them: their centres, how each sits, and the array each is in. */
export function designAutoPanels(design: Layout): AutoPanel[] {
  const panels = designPanels(design);
  // `panelAspects` lists the panels in the same order as `designPanels`.
  const aspects = panelAspects(design);
  const group = panels.map((_, i) => i);
  const find = (i: number): number => (group[i] === i ? i : (group[i] = find(group[i])));
  for (let i = 0; i < panels.length; i++)
    for (let j = i + 1; j < panels.length; j++) if (panelGap(panels[i].corners, panels[j].corners) <= ARRAY_GAP) group[find(i)] = find(j);
  return panels.map((p, i) => ({
    key: p.key,
    x: p.corners.reduce((sum, c) => sum + c.x, 0) / 4,
    y: p.corners.reduce((sum, c) => sum + c.y, 0) / 4,
    tilt: aspects[i].tilt,
    facing: aspects[i].facing,
    array: `a${find(i)}`,
  }));
}

/** Strings for a whole design, on the inverters drawn for it. */
export function autoStringDesign(
  design: Layout,
  inverters: AutoStringInverter[],
  panel?: PanelElectrical,
  panelName?: string,
): AutoStringResult {
  return autoString({ panels: designAutoPanels(design), inverters, panel, panelName });
}
