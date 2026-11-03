import { describe, expect, it } from "vitest";
import { capturedWords, offersOf } from "./nearmap";

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
