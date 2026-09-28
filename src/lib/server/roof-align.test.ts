import { writeArrayBuffer } from "geotiff";
import sharp from "sharp";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { designView, fromPixel, metresPerPixel } from "@/lib/domain/roof-layout";
import { toUtm } from "@/lib/domain/utm";
import { satelliteShift } from "./roof-align";

const ZONE = { zone: 55, south: true };
const LAT = -37.81;
const LNG = 145.02;
const M_LAT = 111_000;
const M_LNG = 111_320 * Math.cos((LAT * Math.PI) / 180);

// A made-up neighbourhood: soft blobs of different sizes, in metres around the home.
const BLOBS = Array.from({ length: 160 }, (_, i) => ({
  e: ((i * 37) % 60) - 30,
  n: ((i * 53) % 60) - 30,
  r: 0.6 + ((i * 7) % 11) * 0.25,
  v: ((i * 29) % 120) - 60,
}));
const ground = (e: number, n: number) =>
  BLOBS.reduce((v, b) => v + b.v * Math.exp(-((e - b.e) ** 2 + (n - b.n) ** 2) / (2 * b.r ** 2)), 128);

/** UTM back to latitude/longitude, by Newton's method (test only). */
function fromUtm(e: number, n: number) {
  let lat = LAT;
  let lng = LNG;
  for (let k = 0; k < 4; k++) {
    const p = toUtm(lat, lng, ZONE);
    const h = 1e-6;
    const pa = toUtm(lat + h, lng, ZONE);
    const pb = toUtm(lat, lng + h, ZONE);
    const [a, b, c, d] = [(pa.e - p.e) / h, (pb.e - p.e) / h, (pa.n - p.n) / h, (pb.n - p.n) / h];
    const [re, rn] = [e - p.e, n - p.n];
    const det = a * d - b * c;
    lat += (d * re - b * rn) / det;
    lng += (a * rn - c * re) / det;
  }
  return { lat, lng };
}

// The satellite photo leans: the roof shows 2 m east and 1.5 m south of where it really is.
const LEAN = { e: 2, n: -1.5 };

async function satelliteJpeg() {
  const view = designView({ lat: LAT, lng: LNG });
  const w = 320;
  const px = new Uint8Array(w * w);
  for (let j = 0; j < w; j++)
    for (let i = 0; i < w; i++) {
      const ll = fromPixel(i * 4 + 2, j * 4 + 2, view);
      const e = (ll.lng - LNG) * M_LNG - LEAN.e;
      const n = (ll.lat - LAT) * M_LAT - LEAN.n;
      px[j * w + i] = Math.max(0, Math.min(255, ground(e, n)));
    }
  return sharp(Buffer.from(px), { raw: { width: w, height: w, channels: 1 } })
    .resize(1280, 1280)
    .jpeg()
    .toBuffer();
}

function solarTiff() {
  const c = toUtm(LAT, LNG, ZONE);
  const size = 0.2;
  const w = 250;
  const [x0, y1] = [c.e - 25, c.n + 25];
  const px = new Uint8Array(w * w * 3);
  for (let j = 0; j < w; j++)
    for (let i = 0; i < w; i++) {
      const ll = fromUtm(x0 + (i + 0.5) * size, y1 - (j + 0.5) * size);
      const v = Math.max(0, Math.min(255, ground((ll.lng - LNG) * M_LNG, (ll.lat - LAT) * M_LAT)));
      px.set([v, v, v], (j * w + i) * 3);
    }
  return writeArrayBuffer(px, {
    width: w,
    height: w,
    SamplesPerPixel: 3,
    BitsPerSample: [8, 8, 8],
    PhotometricInterpretation: 2,
    PlanarConfiguration: 1,
    ModelPixelScale: [size, size, 0],
    ModelTiepoint: [0, 0, 0, x0, y1, 0],
    GTModelTypeGeoKey: 1,
    ProjectedCSTypeGeoKey: 32755,
  });
}

beforeEach(() => {
  vi.stubEnv("GOOGLE_MAPS_API_KEY", "test-key");
  for (const k of ["DATABASE_URL", "POSTGRES_URL", "BLOB_READ_WRITE_TOKEN", "BLOB_STORE_ID"]) vi.stubEnv(k, "");
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("satelliteShift", () => {
  it("moves a leaning satellite photo back into line with Google Solar's", async () => {
    const [jpeg, tiff] = [await satelliteJpeg(), solarTiff()];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: unknown) => {
        const u = String(url);
        if (u.includes("buildingInsights")) return new Response("{}", { status: 404 });
        if (u.includes("dataLayers:get")) return Response.json({ rgbUrl: "https://solar.googleapis.com/v1/geoTiff:get?id=t" });
        if (u.includes("geoTiff:get")) return new Response(tiff);
        return new Response(new Uint8Array(jpeg), { headers: { "content-type": "image/jpeg" } });
      }),
    );
    const shift = await satelliteShift(LAT, LNG);
    const mpp = metresPerPixel(designView({ lat: LAT, lng: LNG }));
    // Drawn 2 m west and 1.5 m north (up) to undo the lean; within about 25 cm.
    expect(shift).not.toBeNull();
    expect(shift!.x * mpp).toBeCloseTo(-2, 0);
    expect(shift!.y * mpp).toBeCloseTo(-1.5, 0);
    expect(Math.abs(shift!.x * mpp + 2)).toBeLessThan(0.25);
    expect(Math.abs(shift!.y * mpp + 1.5)).toBeLessThan(0.25);
  }, 30_000);
});
