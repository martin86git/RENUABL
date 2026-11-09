import { describe, expect, it } from "vitest";
import { packArea, type Area } from "./pack";
import { PANEL, inside } from "./roof-design";
import { boxOnRoof, hasSolar, keepOuts, keptClearWords, roofThings, thingLabel, withoutExisting } from "./roof-check";
import { suggestPanels } from "./suggest";

const lat = -37.936943;

describe("boxOnRoof", () => {
  it("puts the picture's middle at the roof's middle, east right and south down", () => {
    const b = boxOnRoof([450, 450, 550, 550], lat);
    expect((b[0].x + b[2].x) / 2).toBeCloseTo(0, 6);
    expect((b[0].y + b[2].y) / 2).toBeCloseTo(0, 6);
    const r = boxOnRoof([600, 600, 700, 700], lat);
    expect(r[0].x).toBeGreaterThan(0);
    expect(r[0].y).toBeGreaterThan(0);
  });
});

describe("keepOuts and the packer", () => {
  // A face 12 m wide and 7 m deep looking north.
  const face: Area = {
    facing: 0,
    pitch: 22,
    covers: (p) => Math.abs(p.x) <= 6 && p.y >= -3.5 && p.y <= 3.5,
    outline: [
      { x: -6, y: -3.5 },
      { x: 6, y: -3.5 },
      { x: 6, y: 3.5 },
      { x: -6, y: 3.5 },
    ],
    sun: 1,
  };
  const id = (() => {
    let n = 0;
    return () => `p${n++}`;
  })();

  it("lays nothing over the existing panels or within the clearance of a small vent", () => {
    const things = [
      {
        type: "existing panels" as const,
        box: [
          { x: -6, y: -3.5 },
          { x: 0, y: -3.5 },
          { x: 0, y: 3.5 },
          { x: -6, y: 3.5 },
        ],
      },
      {
        type: "vent" as const,
        box: [
          { x: 2.9, y: 0.4 },
          { x: 3.1, y: 0.4 },
          { x: 3.1, y: 0.6 },
          { x: 2.9, y: 0.6 },
        ],
      },
    ];
    const avoid = keepOuts(things);
    const laid = packArea({ ...face, avoid, covers: (p) => face.covers(p) && !avoid.some((q) => inside(p, q)) }, 40, { ...PANEL }, id);
    expect(laid.length).toBeGreaterThan(0);
    const half = PANEL.long / 2;
    for (const p of laid) {
      expect(p.x - half).toBeGreaterThan(0);
      // Not over the vent: its middle is further than half a panel and the clearance from every panel's middle.
      expect(Math.hypot(p.x - 3, p.y - 0.5)).toBeGreaterThan(PANEL.short / 2);
    }
  });

  it("keeps Google's roof model clear too", () => {
    const model = {
      panel: { widthM: 1.13, heightM: 1.96, watts: 400 },
      faces: [{ pitch: 20, azimuth: 0, areaM2: 80, sunHours: 1500 }],
      slots: Array.from({ length: 24 }, (_, i) => ({
        lat: lat + (Math.floor(i / 6) - 1.5) * 0.000018,
        lng: 145.2429111 + ((i % 6) - 2.5) * 0.000014,
        orientation: "PORTRAIT" as const,
        segment: 0,
        kwh: 500,
      })),
    };
    const centre = { lat, lng: 145.2429111 };
    const all = suggestPanels(model as never, centre, 24, { ...PANEL }, id);
    const block = [
      [
        { x: -20, y: -20 },
        { x: 0, y: -20 },
        { x: 0, y: 20 },
        { x: -20, y: 20 },
      ],
    ];
    const kept = suggestPanels(model as never, centre, 24, { ...PANEL }, id, undefined, block);
    expect(kept.length).toBeLessThan(all.length);
    for (const p of kept) expect(p.x).toBeGreaterThan(0);
  });
});

describe("words", () => {
  it("names what was kept clear and whether the home has panels", () => {
    const things = roofThings(
      [
        { type: "existing panels", box: [100, 100, 200, 200] },
        { type: "vent", box: [300, 300, 310, 310] },
        { type: "vent", box: [320, 300, 330, 310] },
        { type: "skylight", box: [400, 400, 420, 420] },
      ],
      lat,
    );
    expect(hasSolar(things)).toBe(true);
    expect(keptClearWords(things)).toBe(
      "Kept clear of the existing panels, 2 vents and a skylight, as the picture shows them: check on site.",
    );
    expect(keptClearWords([])).toBeNull();
    expect(thingLabel(things[0])).toBe("Existing panels");
    expect(thingLabel({ type: "other", note: "pergola frame at rear of roof", box: [] })).toBe("Pergola frame at");
    expect(thingLabel({ type: "other", box: [] })).toBe("Keep clear");
  });
});

describe("what is left out", () => {
  it("drops a large 'something else' (a pergola, a glass roof), keeps a small one and every fixture", () => {
    const things = roofThings(
      [
        { type: "other", note: "polycarbonate roof", box: [300, 300, 600, 600] },
        { type: "other", note: "box", box: [300, 300, 310, 310] },
        { type: "existing panels", box: [100, 100, 400, 400] },
      ],
      lat,
    );
    expect(things.map((t) => t.type)).toEqual(["other", "existing panels"]);
  });
  it("leaves out the existing panels when they are being replaced", () => {
    const things = roofThings(
      [
        { type: "existing panels", box: [100, 100, 200, 200] },
        { type: "vent", box: [300, 300, 310, 310] },
      ],
      lat,
    );
    expect(withoutExisting(things).map((t) => t.type)).toEqual(["vent"]);
  });
});
