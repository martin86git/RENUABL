import { describe, expect, it } from "vitest";
import { inverterCatalogue, panelCatalogue } from "./catalogue";
import { INVERTER_ELECTRICAL, PANEL_ELECTRICAL, checkString } from "./electrical";
import { arrayOversize, suggestInverters } from "./inverter-suggest";
import {
  PANEL,
  angleOfLongestEdge,
  applyCommentOp,
  cleanDesign,
  cleanDesignSet,
  inverterSpot,
  designPanels,
  designSummary,
  facePanels,
  freed,
  looseCorners,
  metresPerPixel,
  monthlyProduction,
  faceFacing,
  packDesignSet,
  panelAspects,
  panelFacing,
  panelPlaces,
  parseDesign,
  stringIsMixed,
  type Face,
} from "./roof-design";
import { MONTHLY_SUN, TILT, bestTilt, compass, gainOverFlat, sunOnPlane, yearOnPlane } from "./tilt";

describe("the roof designer", () => {
  // A plain rectangle of roof, 10 m along the gutter and 4 m up, rows along the gutter.
  const face: Face = {
    id: "a",
    points: [
      { x: -5, y: -2 },
      { x: 5, y: -2 },
      { x: 5, y: 2 },
      { x: -5, y: 2 },
    ],
    angle: 0,
    landscape: false,
    setback: 0,
    facing: "N",
    off: [],
  };
  it("knows the picture's scale: about 12 cm a pixel in Melbourne", () => {
    expect(metresPerPixel(-37.8)).toBeGreaterThan(0.115);
    expect(metresPerPixel(-37.8)).toBeLessThan(0.121);
  });
  it("lays panels in rows that fit inside the face", () => {
    // 10 m takes eight portrait panels across (1.134 m each, with a gap); 4 m takes two rows of 1.762 m.
    expect(panelPlaces(face)).toHaveLength(16);
    expect(panelPlaces({ ...face, landscape: true })).toHaveLength(15);
    for (const panel of panelPlaces(face))
      for (const c of panel.corners) {
        expect(Math.abs(c.x)).toBeLessThanOrEqual(5.0001);
        expect(Math.abs(c.y)).toBeLessThanOrEqual(2.0001);
      }
  });
  it("keeps panels in from the edges, and follows the face when it is turned", () => {
    expect(panelPlaces({ ...face, setback: 0.5 }).length).toBeLessThan(16);
    const turned = { ...face, angle: 30, points: face.points.map((p) => ({ x: p.x * 0.866 - p.y * 0.5, y: p.x * 0.5 + p.y * 0.866 })) };
    expect(panelPlaces(turned)).toHaveLength(16);
  });
  it("lines the rows up with the longest edge, wherever the tracing started", () => {
    // A trapezoid of roof: a long gutter tilted a little, a shorter ridge, and two hips. Traced starting up a hip.
    const hipFirst = [
      { x: -8, y: 3 },
      { x: -5, y: -2 },
      { x: 5, y: -1 },
      { x: 9, y: 5 },
    ];
    // The gutter runs from (9, 5) back to (-8, 3): about seven degrees off level.
    expect(angleOfLongestEdge({ points: hipFirst })).toBe(7);
    // The same face traced from another corner gives the same rows.
    expect(angleOfLongestEdge({ points: [...hipFirst.slice(2), ...hipFirst.slice(0, 2)] })).toBe(7);
    expect(angleOfLongestEdge(face)).toBe(0);
  });
  it("counts what is on, in the costing's panel", () => {
    expect(facePanels({ ...face, off: [0, 1] })).toHaveLength(14);
    const summary = designSummary({ faces: [face, { ...face, id: "b", facing: "S" }] }, 3.6);
    expect(summary.panels).toBe(32);
    expect(summary.kw).toBe((32 * PANEL.watts) / 1000);
    // A south face makes less than a north one, so the pair makes less than two north faces would.
    expect(summary.kwhPerDay).toBeLessThan(summary.kw * 3.6);
    expect(summary.kwhPerDay).toBeGreaterThan(summary.kw * 3.6 * 0.6);
  });
  it("lets a panel be placed by hand: freed from the grid where it stands, then moved and turned", () => {
    // A face drawn at the panels' true size from above, as every face traced now is.
    const drawn = { ...face, plan: true };
    const place = panelPlaces(drawn)[0];
    const panel = freed(drawn, place, "p1");
    // Freed, it covers the place it came from (to the centimetre its position is kept to).
    const key = (c: { x: number; y: number }) => Math.round(c.x * 10) * 1000 + Math.round(c.y * 10);
    const before = [...place.corners].sort((a, b) => key(a) - key(b));
    const after = [...looseCorners(panel)].sort((a, b) => key(a) - key(b));
    after.forEach((c, i) => {
      expect(Math.abs(c.x - before[i].x)).toBeLessThanOrEqual(0.011);
      expect(Math.abs(c.y - before[i].y)).toBeLessThanOrEqual(0.011);
    });
    // Turned a quarter, it lies on its side: wider than it is tall (seen from above, shorter down its slope).
    const turned = looseCorners({ ...panel, angle: 90 });
    const width = Math.max(...turned.map((c) => c.x)) - Math.min(...turned.map((c) => c.x));
    expect(width).toBeCloseTo(PANEL.long * Math.cos(((panel.tilt ?? TILT.roof) * Math.PI) / 180), 5);
    // With its place switched off and the panel placed by hand, the count is what it was.
    const design = { faces: [{ ...face, off: [place.index] }], loose: [panel] };
    expect(designSummary(design).panels).toBe(16);
    // One standing off every face still counts.
    expect(designSummary({ faces: [face], loose: [{ id: "p2", x: 40, y: 40, angle: 0 }] }).panels).toBe(17);
    // One saved before panels had a direction: it isn't turned, and looks north as nearly as it can (here, across its long edge).
    expect(cleanDesign({ lat: -37.8, lng: 145, faces: [], loose: [{ id: "p1", x: 1, y: 2, angle: 270 }, { x: "no" }] })?.loose).toEqual([
      { id: "p1", x: 1, y: 2, angle: 270, across: true, tilt: TILT.roof },
    ]);
  });
  it("keeps strings and labels that make sense, and shapes the year by the sunshine record", () => {
    const keys = designPanels({ faces: [face] }).map((p) => p.key);
    const cleaned = cleanDesign({
      lat: -37.8,
      lng: 145,
      faces: [face],
      // A panel can be in one string only, and a panel that isn't in the design can't be in any.
      strings: [
        { id: "s1", panels: [keys[0], keys[1], "g:a:9999"] },
        { id: "s2", panels: [keys[1], keys[2]] },
        { id: "s3", panels: [] },
      ],
      labels: [
        { id: "n1", x: 1, y: 2, kind: "Inverter", text: "" },
        { x: 3, y: 4, kind: "Rocket", text: "  By the garage\n door " },
        { x: "no" },
      ],
    })!;
    expect(cleaned.strings).toEqual([
      { id: "s1", panels: [keys[0], keys[1]] },
      { id: "s2", panels: [keys[2]] },
    ]);
    expect(cleaned.labels).toEqual([
      { id: "n1", x: 1, y: 2, kind: "Inverter", text: "" },
      { id: "n2", x: 3, y: 4, kind: "Note", text: "By the garage door" },
    ]);
    const year = monthlyProduction({ faces: [face] }, 3.6);
    expect(year).toHaveLength(12);
    // January makes more than twice what June does, as the sunshine record says; lying flat, nearly four times.
    expect(year[0]).toBeGreaterThan(year[5] * 2.5);
    const flat = monthlyProduction({ faces: [{ ...face, tilt: 0 }] }, 3.6);
    expect(flat[0]).toBeGreaterThan(flat[5] * 3.5);
  });
  it("works out what tilt adds from the sunshine record, in line with what is published for Melbourne", () => {
    // Lying flat, a panel gets exactly the sunshine record, whichever way it is turned.
    sunOnPlane(0, 123).forEach((sun, m) => expect(sun).toBeCloseTo(MONTHLY_SUN[m], 1));
    // A north panel does best at about 31 degrees (published: about 32), and flat makes 86 to 90% of that.
    expect(bestTilt(0)).toBeGreaterThanOrEqual(28);
    expect(bestTilt(0)).toBeLessThanOrEqual(34);
    const best = yearOnPlane(bestTilt(0), 0);
    expect(yearOnPlane(0, 0) / best).toBeGreaterThan(0.86);
    expect(yearOnPlane(0, 0) / best).toBeLessThan(0.9);
    // Every degree adds something up to the best tilt, less each time; past it, tilting more loses.
    expect(gainOverFlat(10, 0)).toBeGreaterThan(0.05);
    expect(gainOverFlat(20, 0)).toBeGreaterThan(gainOverFlat(10, 0));
    expect(gainOverFlat(20, 0) - gainOverFlat(10, 0)).toBeLessThan(gainOverFlat(10, 0));
    expect(gainOverFlat(60, 0)).toBeLessThan(gainOverFlat(30, 0));
    // East and west lose a little by tilting; south loses a lot. East and west are a match.
    expect(gainOverFlat(22, 90)).toBeLessThan(0);
    expect(gainOverFlat(22, 90)).toBeGreaterThan(-0.08);
    expect(gainOverFlat(22, 180)).toBeLessThan(-0.15);
    expect(yearOnPlane(22, 90)).toBeCloseTo(yearOnPlane(22, 270), 5);
    // Tilting north takes a little from summer and gives a lot to winter.
    expect(sunOnPlane(30, 0)[0]).toBeLessThan(MONTHLY_SUN[0]);
    expect(sunOnPlane(30, 0)[5]).toBeGreaterThan(MONTHLY_SUN[5] * 1.5);
    expect(compass(0)).toBe("N");
    expect(compass(350)).toBe("N");
    expect(compass(247)).toBe("WSW");
  });
  it("gives every panel a direction and a tilt, and counts what each makes by them", () => {
    // A face's panels look square to its rows, on the side the face is said to point.
    expect(faceFacing({ angle: 0, facing: "N" })).toBe(0);
    expect(faceFacing({ angle: 0, facing: "S" })).toBe(180);
    expect(faceFacing({ angle: 20, facing: "NE" })).toBe(20);
    expect(faceFacing({ angle: -70, facing: "E" })).toBe(110);
    // The setting is for a north roof at the usual pitch: that face makes exactly it.
    const kw = (16 * PANEL.watts) / 1000;
    expect(designSummary({ faces: [face] }, 3.6).kwhPerDay).toBeCloseTo(kw * 3.6, 0);
    // Laid flat it makes less; tilted to the best angle a little more; turned south, much less.
    const made = (f: typeof face) => designSummary({ faces: [f] }, 3.6).kwhPerDay;
    expect(made({ ...face, tilt: 0 })).toBeLessThan(made(face) * 0.93);
    expect(made({ ...face, tilt: 31 })).toBeGreaterThan(made(face));
    expect(made({ ...face, facing: "S" })).toBeLessThan(made(face) * 0.75);
    // A panel taken out of its row keeps the face's direction and pitch, portrait or on its side.
    const south = { ...face, facing: "S" as const, tilt: 15 };
    const upright = freed(south, panelPlaces(south)[0], "p1");
    expect([panelFacing(upright), upright.tilt]).toEqual([180, 15]);
    const side = { ...south, landscape: true };
    const lying = freed(side, panelPlaces(side)[0], "p2");
    expect([panelFacing(lying), lying.across, lying.tilt]).toEqual([180, true, 15]);
    // So freeing a panel changes nothing about what the design makes.
    const freedOne = { faces: [{ ...south, off: [panelPlaces(south)[0].index] }], loose: [upright] };
    expect(designSummary(freedOne, 3.6).kwhPerDay).toBe(designSummary({ faces: [south] }, 3.6).kwhPerDay);
    // Tilting one panel on its own changes the total by that panel only.
    const one = (tilt: number) => designSummary({ faces: [], loose: [{ id: "a", x: 0, y: 0, angle: 0, tilt }] }, 3.6).kwhPerDay;
    expect(one(30)).toBeGreaterThan(one(0));
    expect(panelAspects({ faces: [face], loose: [upright] })).toHaveLength(17);
    // A saved face without a pitch takes the usual one; a pitch out of range is put right.
    expect(cleanDesign({ lat: -37.8, lng: 145, faces: [face] })?.faces[0].tilt).toBe(TILT.roof);
    expect(cleanDesign({ lat: -37.8, lng: 145, faces: [{ ...face, tilt: 400 }] })?.faces[0].tilt).toBe(TILT.roof);
    expect(
      cleanDesign({ lat: -37.8, lng: 145, faces: [], loose: [{ id: "p1", x: 1, y: 2, angle: 200, across: true, tilt: 35 }] })?.loose,
    ).toEqual([{ id: "p1", x: 1, y: 2, angle: 200, across: true, tilt: 35 }]);
  });
  it("keeps a discussion pinned to the drawing: bubbles, replies, resolving", () => {
    const one = applyCommentOp(
      [],
      { do: "add", x: 1.234, y: -2, text: "  Is this\nclear of the skylight? " },
      "a@example",
      "2026-10-09T10:00",
      "c1",
    )!;
    expect(one).toEqual([
      {
        id: "c1",
        x: 1.23,
        y: -2,
        resolved: false,
        notes: [{ by: "a@example", at: "2026-10-09T10:00", text: "Is this clear of the skylight?" }],
      },
    ]);
    const done = applyCommentOp(one, { do: "resolve", id: "c1", resolved: true }, "a@example", "", "x")!;
    expect(done[0].resolved).toBe(true);
    // A reply is by whoever the server says is signed in, and reopens the bubble.
    const two = applyCommentOp(
      done,
      { do: "reply", id: "c1", text: "Yes, 600 mm clear", by: "someone-else" },
      "b@example",
      "2026-10-09T10:05",
      "x",
    )!;
    expect(two[0].notes.map((n) => n.by)).toEqual(["a@example", "b@example"]);
    expect(two[0].resolved).toBe(false);
    // Nothing said, or a bubble that isn't there, changes nothing.
    expect(applyCommentOp(two, { do: "add", x: 0, y: 0, text: "   " }, "a", "", "c2")).toBeNull();
    expect(applyCommentOp(two, { do: "reply", id: "nope", text: "hello" }, "a", "", "x")).toBeNull();
    expect(applyCommentOp(two, { do: "remove", id: "c1" }, "a", "", "x")).toEqual([]);
    // Saved and read back, the discussion survives; empty threads don't.
    const kept = cleanDesign({ lat: -37.8, lng: 145, faces: [], comments: [...two, { id: "c9", x: 0, y: 0, notes: [] }] })!;
    expect(kept.comments).toEqual(two);
  });
  it("only keeps a design that is one", () => {
    const good = { lat: -37.8, lng: 145, faces: [{ ...face, off: [3, 3, 1, -2, 9999] }] };
    expect(cleanDesign(good)?.faces[0].off).toEqual([1, 3]);
    expect(parseDesign(JSON.stringify(good))?.faces).toHaveLength(1);
    expect(cleanDesign({ lat: 51.5, lng: 0, faces: [] })).toBeNull();
    expect(cleanDesign({ lat: -37.8, lng: 145, faces: [{ points: [{ x: 1e9, y: 0 }] }] })).toBeNull();
    expect(parseDesign("not json")).toBeNull();
    expect(parseDesign(null)).toBeNull();
  });
});

const panel = PANEL_ELECTRICAL["JKM475N-48QL6-DV"];
const sh10rs = INVERTER_ELECTRICAL["SGWSH10RS-ADA"];
const sh10rt = INVERTER_ELECTRICAL["SGWSH10.0RT"];
const check = (panels: number, inverter = sh10rs, more: { mppt?: number; sharing?: number; mixed?: boolean } = {}) =>
  checkString({ panels, panel, inverter, mppt: 0, sharing: 1, ...more });
const line = (c: ReturnType<typeof check>, what: RegExp) => c.lines.find((l) => what.test(l.what))!;

it("tests a string at the coldest and hottest it will be", () => {
  // Ten 36.42 V panels: 364 V at 25 degrees, more on a cold morning, less on a hot afternoon.
  const ten = check(10);
  expect(line(ten, /Highest voltage/).value).toBe("389 V");
  expect(line(ten, /Working voltage, hottest/).value).toBe("270 V");
  expect(ten.lines.filter((l) => l.ok === false)).toEqual([]);
  expect(ten.verdict).toBe("good");
});
it("fails a string that goes over the inverter's voltage, or under its tracking range", () => {
  // Seventeen panels reach 664 V on the coldest morning: over a 600 V inverter, fine on a 1000 V one.
  const long = check(17);
  expect(long.verdict).toBe("bad");
  expect(line(long, /Highest voltage/).ok).toBe(false);
  expect(line(check(17, sh10rt, { mppt: 1 }), /Highest voltage/).ok).toBe(true);
  // Too short a string can't hold a three-phase hybrid's tracking range on a hot day.
  const short = check(6, sh10rt, { mppt: 1 });
  expect(short.verdict).toBe("bad");
  expect(line(short, /Working voltage, hottest/).ok).toBe(false);
});
it("adds up the strings sharing an input", () => {
  // Two strings of these panels on a one-string, 20 A input: too much short-circuit current, and one connector.
  const two = check(10, sh10rs, { sharing: 2 });
  expect(two.verdict).toBe("bad");
  expect(line(two, /Short-circuit current/).ok).toBe(false);
  expect(line(two, /Strings on this input/).ok).toBe(false);
  // The SH10RT's second input takes two strings; its first takes one.
  expect(line(check(14, sh10rt, { mppt: 1, sharing: 2 }), /Short-circuit current/).ok).toBe(true);
  expect(line(check(14, sh10rt, { mppt: 0, sharing: 2 }), /Short-circuit current/).ok).toBe(false);
  // More working current than an input uses is clipped, not a fault: something to know.
  const clipped = check(14, sh10rt, { mppt: 0 });
  expect(line(clipped, /Working current/).ok).toBeNull();
  expect(clipped.verdict).toBe("caution");
  // An input the inverter doesn't have.
  expect(check(10, sh10rs, { mppt: 7 }).verdict).toBe("bad");
});
it("never passes what it can't check, and flags a string facing two ways", () => {
  expect(checkString({ panels: 10, mppt: 0, sharing: 1 }).verdict).toBe("unknown");
  const noInverter = checkString({ panels: 10, panel, mppt: 0, sharing: 1 });
  expect(noInverter.verdict).toBe("unknown");
  expect(noInverter.lines.every((l) => l.ok === undefined)).toBe(true);
  // Its voltage is still worked out and said, so it can be held against a datasheet: 10 panels reach 389 V in the cold.
  expect(Math.round(noInverter.coldVoc ?? 0)).toBe(389);
  expect(noInverter.words).toMatch(/No inverter is chosen.*389 V/);
  expect(checkString({ panels: 10, panel, mppt: 0, sharing: 1, inverterChosen: true }).words).toMatch(/limits aren't on file.*389 V/);
  expect(noInverter.lines.some((l) => /Voc at 25 °C: 10 × 36.42 V/.test(l.what) && l.value === "364 V")).toBe(true);
  // Thirteen of these panels: 473 V on the datasheet, 505 V on the coldest morning; fifteen is the most a 600 V inverter takes.
  expect(Math.round(checkString({ panels: 13, panel, mppt: 0, sharing: 1 }).coldVoc ?? 0)).toBe(505);
  expect(check(15).lines[0].ok).toBe(true);
  expect(check(16).lines[0].ok).toBe(false);
  expect(checkString({ panels: 10, mppt: 0, sharing: 1, panelName: "AIKO 500W" }).words).toMatch(/The AIKO 500W's electrical details/);
  expect(check(10, sh10rs, { mixed: true }).lines.some((l) => /face different ways/.test(l.what) && l.ok === null)).toBe(true);
  const face = {
    id: "a",
    points: [
      { x: -5, y: -2 },
      { x: 5, y: -2 },
      { x: 5, y: 2 },
      { x: -5, y: 2 },
    ],
    angle: 0,
    landscape: false,
    setback: 0,
    facing: "N" as const,
    off: [],
  };
  const design = { faces: [face], loose: [{ id: "w", x: 20, y: 0, angle: 270, tilt: 22 }] };
  expect(stringIsMixed(design, { id: "s", panels: ["g:a:0", "g:a:1"] })).toBe(false);
  expect(stringIsMixed(design, { id: "s", panels: ["g:a:0", "l:w"] })).toBe(true);
});

describe("suggesting an inverter for the panels on a design", () => {
  const inverters = inverterCatalogue();
  const suggest = (arrayKw: number, strings: number[] = []) =>
    suggestInverters({ arrayKw, inverters, panel: panelCatalogue()[0].electrical, strings });

  it("offers one of each kind in the catalogue, the smallest the panels don't oversize", () => {
    const s = suggest(6.65);
    expect(s.map((x) => [x.kind, x.inverter.kw, x.count])).toEqual([
      ["Single phase", 5, 1],
      ["Single phase hybrid (takes a battery)", 5, 1],
      ["Three phase", 5, 1],
      ["Three phase hybrid (takes a battery)", 5, 1],
    ]);
    // 6.65 kW on 5 kW is exactly the 133% allowed for; a panel more and it steps up.
    expect(s[0].why).toMatch(/6\.65 kW of panels is 133% of its 5 kW/);
    expect(suggest(7.13).map((x) => x.inverter.kw)).toEqual([8, 6, 8, 10]);
  });
  it("leaves single phase out when one inverter can't take the array, and uses several on three phase", () => {
    expect(suggest(19.95).map((x) => [x.kind, x.inverter.kw, x.count])).toEqual([
      ["Three phase", 15, 1],
      ["Three phase hybrid (takes a battery)", 15, 1],
    ]);
    expect(suggest(40).map((x) => [x.inverter.kw, x.count])).toEqual([
      [15, 3],
      [15, 3],
    ]);
    expect(suggest(0)).toEqual([]);
    expect(suggestInverters({ arrayKw: 6, inverters: [], strings: [] })).toEqual([]);
  });
  it("says so when an inverter's input limits aren't on file", () => {
    expect(suggest(6.65).find((x) => x.kind === "Three phase")!.why).toMatch(/aren't on file/);
  });
  it("knows a controller is a hybrid from the catalogue, not from its name", () => {
    const sigen = inverters.find((i) => /SigenStor/.test(i.name))!;
    expect(sigen.hybrid).toBe(true);
    expect(/hybrid/i.test(sigen.name)).toBe(false);
  });
});

describe("a roof's set of designs", () => {
  it("packs and reads back up to five designs, keeping which is the primary", () => {
    const design = (label: string) => ({ lat: -37.8, lng: 145, faces: [], loose: [], label });
    const set = { designs: [design("A"), design("B"), design("C")], primary: 1, comments: [] };
    const back = cleanDesignSet(JSON.parse(JSON.stringify(packDesignSet(set))))!;
    expect(back.designs.map((d) => d.label)).toEqual(["A", "B", "C"]);
    expect(back.primary).toBe(1);
    expect(cleanDesignSet({ nothing: true })).toBeNull();
  });
});

describe("panels against the inverters they are on", () => {
  it("warns past 133% of the inverters, and not at it", () => {
    // 14 panels of 475 W on 5 kW is exactly 133%.
    expect(arrayOversize(6.65, 5, false)).toMatchObject({ percent: 133, limit: 133, over: false });
    expect(arrayOversize(7.125, 5, false)).toMatchObject({ percent: 143, over: true, liftedByBattery: false });
    expect(arrayOversize(4, 5, false)).toMatchObject({ percent: 80, over: false });
  });
  it("is lifted by a battery on the design", () => {
    expect(arrayOversize(7.125, 5, true)).toMatchObject({ percent: 143, over: false, liftedByBattery: true });
    expect(arrayOversize(6, 5, true)).toMatchObject({ over: false, liftedByBattery: false });
  });
  it("has nothing to say without both panels and an inverter", () => {
    expect(arrayOversize(0, 5, false)).toBeNull();
    expect(arrayOversize(6.65, 0, false)).toBeNull();
  });
});

describe("an inverter standing on the drawing", () => {
  it("keeps the place it was dragged to, and has one of its own until then", () => {
    const kept = cleanDesign({
      lat: -37.8,
      lng: 145,
      faces: [],
      inverters: [{ sku: "SGWSG5.0RS", name: "Sungrow 5kW", kw: 5, x: 3.21, y: -4.5 }],
    })!;
    expect(kept.inverters![0]).toMatchObject({ x: 3.21, y: -4.5 });
    expect(inverterSpot(kept.inverters![0], 0, -37.8)).toEqual({ x: 3.21, y: -4.5 });
    const unplaced = cleanDesign({
      lat: -37.8,
      lng: 145,
      faces: [],
      inverters: [{ sku: "SGWSG5.0RS", name: "Sungrow 5kW", kw: 5, x: "left" }],
    })!;
    expect(unplaced.inverters![0].x).toBeUndefined();
    // Unplaced inverters stand one under the next, to the right of the picture.
    const [first, second] = [inverterSpot({}, 0, -37.8), inverterSpot({}, 1, -37.8)];
    expect(first.x).toBeGreaterThan(0);
    expect(second.y).toBeGreaterThan(first.y);
  });
});

describe("the main switchboard on a design", () => {
  const base = { lat: -37.9, lng: 145.1, faces: [] };
  it("is kept where it was put, to the centimetre", () => {
    expect(cleanDesign({ ...base, switchboard: { x: 3.456, y: -2.1 } })?.switchboard).toEqual({ x: 3.46, y: -2.1 });
  });
  it("is left out when it isn't a place on the drawing", () => {
    expect(cleanDesign({ ...base, switchboard: { x: "here", y: 1 } })?.switchboard).toBeUndefined();
    expect(cleanDesign({ ...base, switchboard: { x: 1e6, y: 1 } })?.switchboard).toBeUndefined();
    expect(cleanDesign(base)?.switchboard).toBeUndefined();
  });
});
