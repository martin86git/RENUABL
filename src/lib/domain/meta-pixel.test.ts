import { describe, expect, it } from "vitest";
import { META_EVENTS, metaPixelId, pixelAllowedPath } from "./meta-pixel";

describe("Meta Pixel", () => {
  it("accepts only a numeric pixel ID", () => {
    expect(metaPixelId(" 1760140778369529 ")).toBe("1760140778369529");
    expect(metaPixelId(undefined)).toBeNull();
    expect(metaPixelId("")).toBeNull();
    expect(metaPixelId("1760140778369529');alert(1)//")).toBeNull();
  });

  it("loads on public pages and the flow only", () => {
    for (const p of ["/", "/learn", "/learn/do-i-need-a-home-battery", "/start", "/start/profile", "/privacy", "/terms", "/contact"])
      expect(pixelAllowedPath(p)).toBe(true);
    // These URLs can carry sign-in links or private record keys.
    for (const p of [
      "/my",
      "/my/installation",
      "/login",
      "/deposit",
      "/deposit/paid",
      "/installer",
      "/admin",
      "/partners",
      "/starter",
      "/learning",
    ])
      expect(pixelAllowedPath(p)).toBe(false);
  });
  it("counts a lead at the reservation, and a bill on its own as BillUploaded", () => {
    expect(META_EVENTS).toEqual({ pageView: "PageView", billUploaded: "BillUploaded", spendEstimated: "SpendEstimated", lead: "Lead" });
  });
});
