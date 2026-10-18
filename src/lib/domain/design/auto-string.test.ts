import { describe, expect, it } from "vitest";
import {
  autoString,
  autoStringDesign,
  designAutoPanels,
  inputCapacity,
  orientationGroups,
  snakeOrder,
  stringRange,
  type AutoPanel,
} from "./auto-string";
import { INVERTER_ELECTRICAL, PANEL_ELECTRICAL } from "./electrical";
import { designPanels, stringIsMixed, type Face, type Layout } from "./roof-design";

const panel = PANEL_ELECTRICAL["JKM475N-48QL6-DV"];
const SG5 = { electrical: INVERTER_ELECTRICAL["SGWSG5.0RS"], name: "SG5.0RS" };
const SH10RT = { electrical: INVERTER_ELECTRICAL["SGWSH10.0RT"], name: "SH10RT" };
const SH15T = { electrical: INVERTER_ELECTRICAL.SGWSH15T, name: "SH15T" };

/** `rows` by `cols` panels looking `facing`, a panel's spacing apart, keyed `<prefix><row>-<col>`. */
function block(prefix: string, rows: number, cols: number, facing = 0, tilt = 22, east = 0): AutoPanel[] {
  const out: AutoPanel[] = [];
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++) out.push({ key: `${prefix}${r}-${c}`, x: east + c * 1.15, y: r * 1.8, tilt, facing });
  return out;
}

const lengths = (r: { strings: { panels: string[] }[] }) => r.strings.map((s) => s.panels.length);

describe("the string lengths an inverter allows", () => {
  it("are worked out from its voltage limits on the coldest and the hottest day", () => {
    // 600 V maximum: 15 panels at about 38.9 V each on the coldest morning; 40 V to start and track: 2.
    expect(stringRange(panel, SG5.electrical)).toEqual({ min: 2, max: 15 });
    // 200 V tracking and 250 V to start on the hottest afternoon: 8; 1000 V maximum: 25.
    expect(stringRange(panel, SH10RT.electrical)).toEqual({ min: 8, max: 25 });
  });

  it("let two strings share an input only when its currents allow", () => {
    expect(inputCapacity(panel, SH15T.electrical, 0)).toBe(2);
    expect(inputCapacity(panel, SH15T.electrical, 2)).toBe(1);
    expect(inputCapacity(panel, SG5.electrical, 0)).toBe(1);
    expect(inputCapacity(panel, SG5.electrical, 9)).toBe(0);
  });
});

describe("stringing the panels", () => {
  it("splits one direction into as few strings as fit, of equal length, one to an input", () => {
    const r = autoString({ panels: block("n", 2, 10), inverters: [SG5], panel });
    expect(lengths(r)).toEqual([10, 10]);
    expect(r.strings.map((s) => s.mppt)).toEqual([0, 1]);
    expect(r.strings.every((s) => s.inverter === undefined)).toBe(true);
    expect(r.left).toEqual([]);
    expect(r.ok).toBe(true);
    expect(r.checks.every((c) => c.verdict === "good")).toBe(true);
    expect(r.note).toMatch(/20 panels in 2 strings/);
    expect(r.note).toMatch(/VERIFY/);
    expect(r.note).not.toMatch(/\bAI\b/);
  });

  it("keeps a string that fits on one input as one string", () => {
    const r = autoString({ panels: block("n", 1, 12), inverters: [SG5], panel });
    expect(lengths(r)).toEqual([12]);
  });

  it("makes near-equal strings when the panels don't split evenly", () => {
    const r = autoString({ panels: block("n", 1, 21), inverters: [SG5], panel });
    expect(lengths(r)).toEqual([11, 10]);
    expect(r.ok).toBe(true);
  });

  it("puts two directions on two inputs and never mixes them in a string", () => {
    const north = block("n", 2, 4, 0);
    const east = block("e", 2, 3, 90, 22, 20);
    const r = autoString({ panels: [...east, ...north], inverters: [SG5], panel });
    expect(lengths(r)).toEqual([8, 6]);
    expect(r.strings[0].panels.every((k) => k.startsWith("n"))).toBe(true);
    expect(r.strings[1].panels.every((k) => k.startsWith("e"))).toBe(true);
    expect(new Set(r.strings.map((s) => s.mppt)).size).toBe(2);
    expect(r.ok).toBe(true);
  });

  it("counts panels a degree or two apart as sitting the same way", () => {
    const a = block("a", 1, 4, 0, 22);
    const b = block("b", 1, 4, 358, 23, 6);
    expect(orientationGroups([...a, ...b])).toHaveLength(1);
    expect(orientationGroups([...a, ...block("c", 1, 4, 30)])).toHaveLength(2);
  });

  it("leaves a group too small to start the inverter, and says why", () => {
    const r = autoString({ panels: block("n", 1, 6), inverters: [SH10RT], panel });
    expect(r.strings).toEqual([]);
    expect(r.left).toHaveLength(6);
    expect(r.ok).toBe(false);
    expect(r.note).toMatch(/fewer than the 8 a string needs/);
  });

  it("strings the big group and leaves a small one that can't reach the voltage", () => {
    const r = autoString({ panels: [...block("n", 2, 6), ...block("e", 1, 5, 90, 22, 20)], inverters: [SH10RT], panel });
    expect(lengths(r)).toEqual([12]);
    expect(r.left).toEqual(block("e", 1, 5).map((p) => p.key));
    expect(r.ok).toBe(true);
    expect(r.note).toMatch(/Not strung: 5 panels facing 90°/);
  });

  it("leaves a direction when there are more directions than inputs", () => {
    const r = autoString({
      panels: [...block("n", 2, 4, 0), ...block("e", 2, 3, 90, 22, 20), ...block("w", 1, 4, 270, 22, -20)],
      inverters: [SG5],
      panel,
    });
    expect(lengths(r)).toEqual([8, 6]);
    expect([...r.left].sort()).toEqual(block("w", 1, 4).map((p) => p.key));
    expect(r.note).toMatch(/no inverter input is left/);
  });

  it("uses only the inputs it needs when the inverter has more", () => {
    const r = autoString({ panels: block("n", 1, 10), inverters: [SH15T], panel });
    expect(lengths(r)).toEqual([10]);
    expect(r.strings[0].mppt).toBe(0);
  });

  it("strings what fits and says what is left when there are too many panels", () => {
    const r = autoString({ panels: block("n", 4, 10), inverters: [SG5], panel });
    expect(lengths(r)).toEqual([15, 15]);
    expect(r.left).toHaveLength(10);
    expect(r.note).toMatch(/10 panels: more than the inputs left can take/);
  });

  it("puts equal strings side by side on an input that takes two, keeping an input for the next direction", () => {
    const r = autoString({ panels: [...block("n", 4, 20), ...block("e", 1, 10, 90, 22, 30)], inverters: [SH15T], panel });
    expect(lengths(r)).toEqual([20, 20, 20, 20, 10]);
    expect(r.strings.map((s) => s.mppt)).toEqual([0, 0, 1, 1, 2]);
    expect(r.left).toEqual([]);
    expect(r.ok).toBe(true);
    expect(r.note).toMatch(/side by side/);
  });

  it("names the second inverter on strings wired to it", () => {
    const r = autoString({
      panels: [...block("n", 1, 12), ...block("e", 1, 10, 90, 22, 20), ...block("w", 1, 9, 270, 22, -20)],
      inverters: [SG5, SG5],
      panel,
    });
    expect(r.strings.map((s) => [s.inverter ?? 0, s.mppt])).toEqual([
      [0, 0],
      [0, 1],
      [1, 0],
    ]);
    expect(r.note).toMatch(/inverter 2, input 1/);
  });
});

describe("when the details aren't on file", () => {
  const panels = block("n", 1, 10);

  it("makes no strings without the panel's details", () => {
    const r = autoString({ panels, inverters: [SG5], panelName: "Mystery 440" });
    expect(r).toMatchObject({ strings: [], ok: false });
    expect(r.left).toHaveLength(10);
    expect(r.note).toMatch(/Mystery 440's electrical details .* aren't on file/);
  });

  it("makes no strings without an inverter", () => {
    const r = autoString({ panels, inverters: [], panel });
    expect(r.strings).toEqual([]);
    expect(r.note).toMatch(/Choose an inverter/);
  });

  it("makes no strings when an inverter's limits aren't on file", () => {
    const r = autoString({ panels, inverters: [SG5, { name: "Other 8kW" }], panel });
    expect(r.strings).toEqual([]);
    expect(r.ok).toBe(false);
    expect(r.note).toMatch(/Inverter 2 \(Other 8kW\)'s input limits aren't on file/);
  });

  it("says so when there are no panels", () => {
    expect(autoString({ panels: [], inverters: [SG5], panel })).toMatchObject({ strings: [], left: [], ok: false });
  });
});

describe("the order along a string", () => {
  it("goes row by row from the top of the slope, turning back at the end of each row", () => {
    // North-facing: the top of the slope is to the south (larger y). Rows at y = 1.8 and y = 0.
    const order = snakeOrder(block("p", 2, 3, 0), 0).map((p) => p.key);
    expect(order).toEqual(["p1-0", "p1-1", "p1-2", "p0-2", "p0-1", "p0-0"]);
  });

  it("finishes one array before starting the next", () => {
    const a = block("a", 2, 2, 0).map((p) => ({ ...p, array: "a" }));
    const b = block("b", 2, 2, 0, 22, 10).map((p) => ({ ...p, array: "b" }));
    const order = snakeOrder([...b, ...a], 0).map((p) => p.key);
    expect(order.slice(0, 4).every((k) => k.startsWith("a"))).toBe(true);
    expect(order.slice(4).every((k) => k.startsWith("b"))).toBe(true);
  });

  it("joins only neighbours in each string", () => {
    const r = autoString({ panels: block("n", 3, 6), inverters: [SG5], panel });
    const at = new Map(block("n", 3, 6).map((p) => [p.key, p]));
    for (const s of r.strings)
      for (let i = 1; i < s.panels.length; i++) {
        const a = at.get(s.panels[i - 1])!;
        const b = at.get(s.panels[i])!;
        expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeLessThan(2);
      }
  });
});

describe("stringing a whole design", () => {
  const face = (id: string, facing: Face["facing"], east: number): Face => ({
    id,
    points: [
      { x: east, y: 0 },
      { x: east + 7, y: 0 },
      { x: east + 7, y: 4 },
      { x: east, y: 4 },
    ],
    angle: 0,
    landscape: false,
    setback: 0.2,
    facing,
    tilt: 22,
    off: [],
  });
  const design: Layout = { faces: [face("f1", "N", 0), face("f2", "S", 20)] };

  it("strings every panel on the design, one direction to a string", () => {
    const keys = designPanels(design).map((p) => p.key);
    expect(keys.length).toBeGreaterThan(4);
    const r = autoStringDesign(design, [SG5], panel);
    expect(r.ok).toBe(true);
    expect(r.strings.flatMap((s) => s.panels).sort()).toEqual([...keys].sort());
    for (const s of r.strings) {
      expect(new Set(s.panels.map((k) => k.split(":")[1])).size).toBe(1);
      expect(stringIsMixed(design, s)).toBe(false);
    }
  });

  it("gives each panel its centre, its look and its array", () => {
    const panels = designAutoPanels(design);
    expect(new Set(panels.map((p) => p.array)).size).toBe(2);
    expect(new Set(panels.map((p) => Math.round(p.facing)))).toEqual(new Set([0, 180]));
  });
});
