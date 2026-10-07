import { describe, expect, it } from "vitest";
import { cleanHubspotToken, hubspotTokenFrom, looksLikeHubspotToken } from "./hubspot-token";

describe("HubSpot token from Vercel", () => {
  it("forgives spaces, quote marks and a leading Bearer", () => {
    expect(cleanHubspotToken('  "pat-ap1-abcdef-1234-5678"  ')).toBe("pat-ap1-abcdef-1234-5678");
    expect(cleanHubspotToken("Bearer pat-ap1-abcdef-1234-5678")).toBe("pat-ap1-abcdef-1234-5678");
    expect(cleanHubspotToken("   ")).toBeNull();
  });

  it("takes the long name, else the short one", () => {
    expect(hubspotTokenFrom({ HUBSPOT_TOKEN: "pat-ap1-x" })).toBe("pat-ap1-x");
    expect(hubspotTokenFrom({ HUBSPOT_PRIVATE_APP_TOKEN: "pat-na1-a", HUBSPOT_TOKEN: "pat-ap1-b" })).toBe("pat-na1-a");
    expect(hubspotTokenFrom({})).toBeNull();
  });

  it("spots a value that isn't a private app token", () => {
    // Built from parts so it doesn't look like a real token to secret scanners.
    expect(looksLikeHubspotToken(["pat", "ap1", "sample-not-a-real-token"].join("-"))).toBe(true);
    expect(looksLikeHubspotToken("443761924")).toBe(false);
    expect(looksLikeHubspotToken(null)).toBe(false);
  });
});
