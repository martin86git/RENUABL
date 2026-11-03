import { describe, expect, it } from "vitest";
import { capturedWords, offersOf, recentCaptures } from "./nearmap";

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
