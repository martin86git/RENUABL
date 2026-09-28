import { afterEach, describe, expect, it, vi } from "vitest";
import { sampleRoofLocation } from "./sample-roof";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("sampleRoofLocation", () => {
  it("finds the sample home through Google Places, once", async () => {
    vi.stubEnv("GOOGLE_MAPS_API_KEY", "test-key");
    const calls: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: unknown, init?: RequestInit) => {
        const u = String(url);
        calls.push(u);
        if (u.endsWith("places:autocomplete")) {
          expect(JSON.parse(String(init?.body)).input).toContain("112 Leopold Street, South Yarra");
          return Response.json({ suggestions: [{ placePrediction: { placeId: "p1", text: { text: "112 Leopold St" } } }] });
        }
        return Response.json({
          id: "p1",
          location: { latitude: -37.84, longitude: 144.99 },
          addressComponents: [
            { longText: "112", shortText: "112", types: ["street_number"] },
            { longText: "Leopold Street", shortText: "Leopold St", types: ["route"] },
            { longText: "South Yarra", shortText: "South Yarra", types: ["locality"] },
            { longText: "Victoria", shortText: "VIC", types: ["administrative_area_level_1"] },
            { longText: "3141", shortText: "3141", types: ["postal_code"] },
          ],
        });
      }),
    );
    expect(await sampleRoofLocation()).toEqual({ lat: -37.84, lng: 144.99 });
    await sampleRoofLocation();
    expect(calls).toHaveLength(2);
  });
});
