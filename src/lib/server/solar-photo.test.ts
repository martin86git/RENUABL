import { writeArrayBuffer } from "geotiff";
import sharp from "sharp";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { roofPhoto } from "./solar-photo";

// A 40 × 30 RGB GeoTIFF on UTM zone 55 south, 0.1 m pixels, top-left at (320 700, 5 812 915): like Google's.
function geoTiff() {
  const [w, h] = [40, 30];
  const pixels = new Uint8Array(w * h * 3).map((_, i) => (i % 3 === 0 ? 200 : 40));
  return writeArrayBuffer(pixels, {
    width: w,
    height: h,
    SamplesPerPixel: 3,
    BitsPerSample: [8, 8, 8],
    PhotometricInterpretation: 2,
    PlanarConfiguration: 1,
    ModelPixelScale: [0.1, 0.1, 0],
    ModelTiepoint: [0, 0, 0, 320_700, 5_812_915, 0],
    GTModelTypeGeoKey: 1,
    ProjectedCSTypeGeoKey: 32755,
  });
}

let lng = 144.96;
beforeEach(() => {
  vi.stubEnv("GOOGLE_MAPS_API_KEY", "test-key");
  for (const k of ["DATABASE_URL", "POSTGRES_URL", "BLOB_READ_WRITE_TOKEN", "BLOB_STORE_ID"]) vi.stubEnv(k, "");
  lng += 0.001;
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("roofPhoto", () => {
  it("turns Google Solar's GeoTIFF into a JPEG with its UTM grid", async () => {
    const urls: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: unknown) => {
        const u = String(url);
        urls.push(u);
        if (u.includes("buildingInsights")) return new Response("{}", { status: 404 });
        if (u.includes("dataLayers:get")) return Response.json({ rgbUrl: "https://solar.googleapis.com/v1/geoTiff:get?id=abc" });
        return new Response(geoTiff());
      }),
    );
    const photo = await roofPhoto(-37.8136, lng);
    expect(photo?.frame).toEqual({ epsg: 32755, bbox: [320_700, 5_812_912, 320_704, 5_812_915], width: 40, height: 30 });
    const meta = await sharp(photo!.jpeg).metadata();
    expect([meta.format, meta.width, meta.height]).toEqual(["jpeg", 40, 30]);
    expect(urls.at(-1)).toBe("https://solar.googleapis.com/v1/geoTiff:get?id=abc&key=test-key");
  });

  it("gives up quietly when Google has no layers", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("{}", { status: 404 })),
    );
    expect(await roofPhoto(-37.8136, lng)).toBeNull();
  });
});
