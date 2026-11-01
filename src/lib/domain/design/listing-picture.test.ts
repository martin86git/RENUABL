import { describe, expect, it } from "vitest";
import { hull, listingDrawing, listingPictureSvg, roofClip } from "./listing-picture";
import { listingBreakdown, switchboardWork, type ListingSystem } from "./marketplace";
import type { RoofDesign } from "./roof-design";

const panel = (id: string, x: number) => ({ id, x, y: 0, angle: 0 });
const loose = {
  lat: -37.88,
  lng: 145.16,
  faces: [],
  loose: [panel("a", -2), panel("b", 0), panel("c", 2)],
  strings: [],
  inverters: [{ sku: "INV", name: "Inverter", kw: 5, x: 4, y: 3 }],
} as unknown as RoofDesign;

describe("the listing's roof picture", () => {
  it("keeps sharp only a little past loose panels", () => {
    const clip = roofClip(loose)!;
    expect(clip).toHaveLength(1);
    const xs = clip[0].map((p) => p.x);
    // Three panels about 6 m across: the sharp part is a few metres wide, never the whole picture.
    expect(Math.max(...xs) - Math.min(...xs)).toBeLessThan(120);
    expect(Math.max(...xs) - Math.min(...xs)).toBeGreaterThan(20);
  });

  it("keeps a traced face sharp when panels sit on it", () => {
    const withFace = {
      ...loose,
      loose: [panel("a", 0)],
      faces: [
        {
          id: "f",
          points: [
            { x: -6, y: -4 },
            { x: 6, y: -4 },
            { x: 6, y: 4 },
            { x: -6, y: 4 },
          ],
          angle: 0,
          landscape: false,
          setback: 0.3,
          facing: "N",
          off: [],
        },
      ],
    } as unknown as RoofDesign;
    const clip = roofClip(withFace)!;
    expect(clip).toHaveLength(1);
    expect(clip[0]).toHaveLength(4);
  });

  it("has nothing to draw with no panels", () => {
    expect(roofClip({ ...loose, loose: [] } as RoofDesign)).toBeNull();
    expect(listingDrawing({ ...loose, loose: [] } as RoofDesign)).toBeNull();
  });

  it("blurs the photo everywhere and shows it sharp only inside the roof", () => {
    const d = listingDrawing(loose)!;
    const svg = listingPictureSvg({ ...d, sharp: "data:image/png;base64,S", blurred: "data:image/png;base64,B" });
    expect(svg).toContain('<clipPath id="roof">');
    expect(svg.match(/<image href="data:image\/png;base64,S"[^>]*clip-path="url\(#roof\)"/)).not.toBeNull();
    expect(svg.match(/<image href="data:image\/png;base64,B"(?![^>]*clip-path)/)).not.toBeNull();
    // Without a photo it is the panels on a plain ground.
    expect(listingPictureSvg({ ...d, sharp: null, blurred: null })).not.toContain("<image");
  });

  it("finds a hull", () => {
    expect(
      hull([
        { x: 0, y: 0 },
        { x: 2, y: 0 },
        { x: 1, y: 1 },
        { x: 2, y: 2 },
        { x: 0, y: 2 },
      ]),
    ).toHaveLength(4);
  });
});

describe("what an installer sees before bidding", () => {
  const system: ListingSystem = {
    kw: 6.65,
    panels: 14,
    panel: "Jinko 475 W",
    inverter: "Sungrow 5 kW hybrid",
    batteryKwh: 16,
    battery: "Sigenergy SigenStor",
    ev: false,
    storeys: "Single",
    roof: "Tile",
    phases: "Single",
    arrays: 2,
    strings: 2,
    tiltFrames: false,
    switchboard: "included",
  };
  const row = (s: ListingSystem, label: string) => listingBreakdown(s).find((r) => r.label === label)!;

  it("says yes or no for each piece of work, in the same order every time", () => {
    expect(listingBreakdown(system).map((r) => r.label)).toEqual([
      "System",
      "Panels",
      "Inverter",
      "Battery",
      "EV charger",
      "Switchboard upgrade",
      "Arrays",
      "Strings",
      "Tilt frames",
      "Storeys",
      "Roof",
      "Phase",
    ]);
    expect(row(system, "Panels").value).toBe("14 × Jinko 475 W");
    expect(row(system, "Battery")).toEqual({ label: "Battery", value: "16 kWh · Sigenergy SigenStor", has: true });
    expect(row(system, "EV charger")).toEqual({ label: "EV charger", value: "No EV charger", has: false });
    expect(row(system, "Switchboard upgrade").has).toBe(true);
  });

  it("reads an older listing without the new facts", () => {
    const old = { ...system, arrays: undefined, strings: undefined, tiltFrames: undefined, switchboard: undefined, battery: undefined };
    expect(row(old, "Switchboard upgrade").value).toBe("To confirm on site");
    expect(row(old, "Arrays").value).toBe("Not given");
  });

  it("reads the switchboard upgrade from the quote as it was decided", () => {
    expect(switchboardWork({ on: true })).toBe("included");
    expect(switchboardWork({ removed: true })).toBe("excluded");
    expect(switchboardWork(undefined)).toBe("to-confirm");
  });
});

describe("the listing picture's frame", () => {
  it("is 4:3 like the card, and stays on the photo", () => {
    const [x, y, w, h] = listingDrawing(loose)!.drawing.viewBox.split(" ").map(Number);
    expect(w / h).toBeCloseTo(4 / 3, 2);
    expect(x).toBeGreaterThanOrEqual(0);
    expect(y).toBeGreaterThanOrEqual(0);
    expect(x + w).toBeLessThanOrEqual(640.1);
    expect(y + h).toBeLessThanOrEqual(400.1);
  });
});
