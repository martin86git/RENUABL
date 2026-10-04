import { describe, expect, it } from "vitest";
import { conversionLabel, conversionTarget, googleAdsId, landingSource } from "./google-ads";

describe("Google Ads", () => {
  it("accepts only a Google Ads tag ID and plain labels", () => {
    expect(googleAdsId(" AW-123456789 ")).toBe("AW-123456789");
    expect(googleAdsId("G-ABC123")).toBeNull();
    expect(googleAdsId("AW-123');alert(1)//")).toBeNull();
    expect(googleAdsId(undefined)).toBeNull();
    expect(conversionLabel("AbC-12_xyz")).toBe("AbC-12_xyz");
    expect(conversionLabel("a b")).toBeNull();
    expect(conversionLabel("")).toBeNull();
  });

  it("only sends a conversion that's set up", () => {
    expect(conversionTarget("AW-123456789", "AbC-12_xyz")).toBe("AW-123456789/AbC-12_xyz");
    expect(conversionTarget("AW-123456789", null)).toBeNull();
    expect(conversionTarget(null, "AbC-12_xyz")).toBeNull();
  });

  it("works out the ad source from the landing link", () => {
    expect(landingSource("?utm_source=meta&gclid=x")).toBe("meta");
    expect(landingSource("?gclid=abc")).toBe("google");
    expect(landingSource("?wbraid=abc")).toBe("google");
    expect(landingSource("?fbclid=abc")).toBe("meta");
    expect(landingSource("")).toBeNull();
  });
});
