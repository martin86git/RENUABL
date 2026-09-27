import { afterEach, describe, expect, it, vi } from "vitest";
import { addressFromComponents, inLaunchMarket, placesProblem } from "@/lib/domain/address";
import { autocomplete, placeAddress } from "./google-places";

afterEach(() => vi.unstubAllGlobals());

const components = [
  { longText: "2", shortText: "2", types: ["street_number"] },
  { longText: "Hanwell Court", shortText: "Hanwell Ct", types: ["route"] },
  { longText: "Glen Waverley", shortText: "Glen Waverley", types: ["locality", "political"] },
  { longText: "Victoria", shortText: "VIC", types: ["administrative_area_level_1", "political"] },
  { longText: "3150", shortText: "3150", types: ["postal_code"] },
];

describe("addresses", () => {
  it("builds a street address from Google's components", () => {
    expect(addressFromComponents(components, { lat: -37.88, lng: 145.16, placeId: "p1" })).toEqual({
      line: "2 Hanwell Court",
      suburb: "Glen Waverley",
      state: "VIC",
      postcode: "3150",
      lat: -37.88,
      lng: 145.16,
      placeId: "p1",
    });
    expect(addressFromComponents([{ longText: "4", types: ["subpremise"] }, ...components])!.line).toBe("4/2 Hanwell Court");
    // A suburb alone isn't a street address.
    expect(addressFromComponents(components.slice(2))).toBeNull();
  });

  it("knows the launch market", () => {
    expect(inLaunchMarket({ state: "VIC" })).toBe(true);
    expect(inLaunchMarket({ state: "NSW" })).toBe(false);
  });

  it("asks Google for Australian street addresses and maps the suggestions", async () => {
    const fetchMock = vi.fn<typeof fetch>(async () =>
      Response.json({
        suggestions: [
          {
            placePrediction: {
              placeId: "abc",
              text: { text: "2 Hanwell Court, Glen Waverley VIC, Australia" },
              structuredFormat: { mainText: { text: "2 Hanwell Court" }, secondaryText: { text: "Glen Waverley VIC, Australia" } },
            },
          },
        ],
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    expect(await autocomplete("2 Hanwell", "s1", "key")).toEqual([
      { id: "abc", main: "2 Hanwell Court", secondary: "Glen Waverley VIC, Australia" },
    ]);
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toBe("https://places.googleapis.com/v1/places:autocomplete");
    expect(new Headers(init!.headers).get("X-Goog-Api-Key")).toBe("key");
    const body = JSON.parse(init!.body as string);
    expect(body).toMatchObject({ input: "2 Hanwell", sessionToken: "s1", includedRegionCodes: ["au"] });
  });

  it("fetches the chosen place with only the fields it needs", async () => {
    const fetchMock = vi.fn<typeof fetch>(async () =>
      Response.json({ id: "abc", addressComponents: components, location: { latitude: -37.88, longitude: 145.16 } }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const address = await placeAddress("abc", "s1", "key");
    expect(address).toMatchObject({ line: "2 Hanwell Court", state: "VIC", lat: -37.88, lng: 145.16 });
    expect(new Headers(fetchMock.mock.calls[0][1]!.headers).get("X-Goog-FieldMask")).toBe("id,addressComponents,location");
  });
});

describe("placesProblem", () => {
  const google = (reason: string, message: string, code = 403) =>
    JSON.stringify({ error: { code, message, status: "PERMISSION_DENIED", details: [{ reason }] } });

  it("explains each common Google Cloud setup problem", () => {
    expect(placesProblem(400, google("API_KEY_INVALID", "API key not valid. Please pass a valid API key.", 400)).fix).toMatch(
      /isn't valid/,
    );
    expect(placesProblem(403, google("SERVICE_DISABLED", "Places API (New) has not been used in project 123")).fix).toMatch(/Enable/);
    expect(placesProblem(403, google("BILLING_DISABLED", "This API method requires billing to be enabled.")).fix).toMatch(/Billing/);
    expect(placesProblem(403, google("API_KEY_HTTP_REFERRER_BLOCKED", "Requests from referer <empty> are blocked.")).fix).toMatch(
      /Application restrictions → None/,
    );
    expect(placesProblem(403, google("API_KEY_SERVICE_BLOCKED", "Requests to this API are blocked.")).fix).toMatch(/API restrictions/);
  });

  it("keeps Google's reason and copes with a non-JSON body", () => {
    expect(placesProblem(403, google("SERVICE_DISABLED", "disabled")).reason).toBe("SERVICE_DISABLED: disabled");
    expect(placesProblem(500, "<html>oops</html>").reason).toBe("HTTP 500: <html>oops</html>");
  });
});
