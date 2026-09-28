import { writeArrayBuffer } from "geotiff";
import sharp from "sharp";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { toUtm } from "@/lib/domain/utm";
import { sunMap } from "./sun-map";

const LAT = -37.8136;
let lng = 144.97;
const W = 60;
const H = 40;

function tiff(values: ArrayLike<number>, samples: number, bits: number, float = false) {
  const c = toUtm(LAT, lng, { zone: 55, south: true });
  return writeArrayBuffer(values as number[], {
    width: W,
    height: H,
    SamplesPerPixel: samples,
    BitsPerSample: Array(samples).fill(bits),
    ...(float ? { SampleFormat: [3] } : {}),
    PhotometricInterpretation: samples === 3 ? 2 : 1,
    PlanarConfiguration: 1,
    ModelPixelScale: [0.1, 0.1, 0],
    ModelTiepoint: [0, 0, 0, c.e - 3, c.n + 2, 0],
    GTModelTypeGeoKey: 1,
    ProjectedCSTypeGeoKey: 32755,
  });
}

beforeEach(() => {
  vi.stubEnv("GOOGLE_MAPS_API_KEY", "test-key");
  for (const k of ["DATABASE_URL", "POSTGRES_URL", "BLOB_READ_WRITE_TOKEN", "BLOB_STORE_ID"]) vi.stubEnv(k, "");
  lng += 0.001;
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("sunMap", () => {
  it("colours the home's roof from Google's sunlight layer, leaving the neighbour's out", async () => {
    // The home's roof: columns 0–39; a neighbour's: 50–59. The right half of the home's roof is shaded.
    const mask = Uint8Array.from({ length: W * H }, (_, i) => (i % W < 40 || i % W >= 50 ? 1 : 0));
    const flux = Float32Array.from({ length: W * H }, (_, i) => (i % W < 20 ? 1500 : 600));
    const rgb = new Uint8Array(W * H * 3).fill(120);
    const layers = {
      annualFluxUrl: "https://solar.googleapis.com/v1/geoTiff:get?id=flux",
      maskUrl: "https://solar.googleapis.com/v1/geoTiff:get?id=mask",
      rgbUrl: "https://solar.googleapis.com/v1/geoTiff:get?id=rgb",
    };
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: unknown) => {
        const u = String(url);
        if (u.includes("buildingInsights")) return new Response("{}", { status: 404 });
        if (u.includes("dataLayers:get")) return Response.json(layers);
        if (u.includes("id=flux")) return new Response(tiff(flux, 1, 32, true));
        if (u.includes("id=mask")) return new Response(tiff(mask, 1, 8));
        return new Response(tiff(rgb, 3, 8));
      }),
    );
    const map = await sunMap(LAT, lng);
    expect(map).not.toBeNull();
    expect(map!.summary.shadedShare).toBeCloseTo(0.5, 1);
    const { data, info } = await sharp(map!.png).raw().toBuffer({ resolveWithObject: true });
    const alpha = (x: number, y: number) => data[(y * info.width + x) * info.channels + 3];
    expect(alpha(5, 10)).toBeGreaterThan(0); // the home's roof
    expect(alpha(45, 10)).toBe(0); // the gap
    expect(alpha(55, 10)).toBe(0); // the neighbour's roof
  });
});
