import { describe, expect, it } from "vitest";
import { capturedWords, homeOutline, offersOf, outlineArea, recentCaptures, ringToPoints, simplifyOutline } from "./nearmap";
import { metresPerPixel } from "./roof-design";

describe("Nearmap in the designer", () => {
  it("says a capture's date in words", () => {
    expect(capturedWords("2026-09-02")).toMatch(/^2 Sept? 2026$/);
    expect(capturedWords(null)).toBe("date not given");
    expect(capturedWords("soon")).toBe("date not given");
  });
  it("reads what a capture offers from Nearmap's resource names", () => {
    expect(offersOf(["tiles:Vert"])).toEqual({ heights: false, trueOrtho: false, mesh: false, obliques: false });
    const all = offersOf(["tiles:Vert", "tiles:North", "tiles:South", "DetailDsm", "TrueOrtho", "3dMesh:Mesh"]);
    expect(all).toEqual({ heights: true, trueOrtho: true, mesh: true, obliques: true });
    expect(offersOf(["Dsm"]).heights).toBe(true);
    expect(offersOf(["tiles:Vert"]).obliques).toBe(false);
  });
});

describe("the captures offered", () => {
  it("keeps the last two years, newest first", () => {
    const got = recentCaptures(
      [
        { captured: "2024-11-02" },
        { captured: "2026-04-25" },
        { captured: "2024-11-03" },
        { captured: "2026-09-12" },
        { captured: "2026-12-01" },
      ],
      "2026-11-03",
    );
    expect(got.map((c) => c.captured)).toEqual(["2026-09-12", "2026-04-25", "2024-11-03"]);
  });
});

describe("Nearmap's roof outline as a face", () => {
  const centre = { lat: -37.8869, lng: 145.1681 };
  // About so many metres east (x) and south (y) of the centre, as [lng, lat].
  const at = (x: number, y: number): [number, number] => [
    centre.lng + x / (111_320 * Math.cos((centre.lat * Math.PI) / 180)),
    centre.lat - y / 110_574,
  ];
  const box = (x0: number, y0: number, x1: number, y1: number) => [at(x0, y0), at(x1, y0), at(x1, y1), at(x0, y1), at(x0, y0)];

  it("puts a ring in metres from the middle of the picture, east and south, without its closing corner", () => {
    const pts = ringToPoints(box(-5, -4, 5, 4), centre);
    expect(pts).toHaveLength(4);
    expect(pts[1].x).toBeGreaterThan(4.5);
    expect(pts[1].x).toBeLessThan(5.5);
    expect(pts[2].y).toBeGreaterThan(3.5);
    expect(pts[2].y).toBeLessThan(4.5);
    // The picture's own scale: one pixel of a zoom 20 picture is metresPerPixel metres.
    expect(metresPerPixel(centre.lat)).toBeGreaterThan(0.1);
  });

  it("drops corners on a straight edge, keeps the real ones", () => {
    const square = [
      { x: 0, y: 0 },
      { x: 5, y: 0.02 },
      { x: 10, y: 0 },
      { x: 10, y: 10 },
      { x: 0, y: 10 },
    ];
    expect(simplifyOutline(square)).toEqual([
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 10 },
      { x: 0, y: 10 },
    ]);
    const round = Array.from({ length: 200 }, (_, i) => ({ x: 10 * Math.cos(i / 31.8), y: 10 * Math.sin(i / 31.8) }));
    expect(simplifyOutline(round).length).toBeLessThanOrEqual(40);
    expect(outlineArea(square)).toBeCloseTo(100, 0);
  });

  it("takes the roof the address is on, else the nearest within a front yard, never a neighbour's", () => {
    const home = box(-6, -5, 6, 5);
    const neighbour = box(20, -5, 32, 5);
    expect(outlineArea(homeOutline([neighbour, home], centre)!)).toBeGreaterThan(110);
    // The address point in the front yard, 4 m in front of the house.
    expect(homeOutline([box(-6, -15, 6, -4), neighbour], centre)).not.toBeNull();
    expect(homeOutline([neighbour], centre)).toBeNull();
    expect(homeOutline([], centre)).toBeNull();
  });
});

describe("what the designer says about Nearmap's outline", () => {
  it("lays a flat roof, and asks for a pitched one's slopes", async () => {
    const { outlineNote } = await import("./nearmap");
    expect(outlineNote(true, "2026-04-25", 18)).toMatch(/^18 panels laid on Nearmap's roof outline \(25 Apr 2026\) as one flat face/);
    expect(outlineNote(true, null)).toMatch(/^Put down Nearmap's roof outline as one flat face/);
    expect(outlineNote(false, "2026-04-25")).toMatch(/no pitch or direction.*trace each slope/);
  });
});
