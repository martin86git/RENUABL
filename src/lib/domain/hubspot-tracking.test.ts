import { describe, expect, it } from "vitest";
import { HUBSPOT_TRACKING, hubspotAllowedPath, hubspotScriptSrc } from "./hubspot-tracking";

describe("HubSpot tracking code", () => {
  it("loads RENUABL's script from HubSpot's Asia-Pacific servers", () => {
    expect(hubspotScriptSrc()).toBe(`https://js-ap1.hs-scripts.com/${HUBSPOT_TRACKING.portalId}.js`);
    expect(hubspotScriptSrc("abc", "ap1")).toBeNull();
    expect(hubspotScriptSrc("123456", "ap1/../x")).toBeNull();
  });

  it("runs on public pages and the plan only", () => {
    for (const p of ["/", "/battery", "/start/profile", "/learn/do-i-need-a-home-battery", "/book-a-call"])
      expect(hubspotAllowedPath(p)).toBe(true);
    for (const p of ["/my", "/my/installation", "/login", "/admin", "/installer", "/deposit", "/brief/abc", "/home-health"])
      expect(hubspotAllowedPath(p)).toBe(false);
  });
});
