/**
 * Latitude/longitude to UTM (WGS84), for Google Solar's aerial photos, which
 * come as GeoTIFFs on a UTM grid (EPSG 326xx north, 327xx south). Standard
 * transverse Mercator series: well under a centimetre across a roof. Pure and tested.
 */

const A = 6_378_137;
const F = 1 / 298.257_223_563;
const E2 = F * (2 - F);
const EP2 = E2 / (1 - E2);
const K0 = 0.9996;

export interface UtmZone {
  zone: number;
  south: boolean;
}

/** The UTM zone an EPSG code names (32601–32660 north, 32701–32760 south), else null. */
export function utmZoneFromEpsg(code: number): UtmZone | null {
  if (code >= 32601 && code <= 32660) return { zone: code - 32600, south: false };
  if (code >= 32701 && code <= 32760) return { zone: code - 32700, south: true };
  return null;
}

/** Easting and northing, metres. */
export function toUtm(lat: number, lng: number, { zone, south }: UtmZone): { e: number; n: number } {
  const phi = (lat * Math.PI) / 180;
  const lambda0 = (((zone - 1) * 6 - 180 + 3) * Math.PI) / 180;
  const lambda = (lng * Math.PI) / 180;
  const sin = Math.sin(phi);
  const cos = Math.cos(phi);
  const tan = Math.tan(phi);
  const n = A / Math.sqrt(1 - E2 * sin * sin);
  const t = tan * tan;
  const c = EP2 * cos * cos;
  const a = cos * (lambda - lambda0);
  const m =
    A *
    ((1 - E2 / 4 - (3 * E2 ** 2) / 64 - (5 * E2 ** 3) / 256) * phi -
      ((3 * E2) / 8 + (3 * E2 ** 2) / 32 + (45 * E2 ** 3) / 1024) * Math.sin(2 * phi) +
      ((15 * E2 ** 2) / 256 + (45 * E2 ** 3) / 1024) * Math.sin(4 * phi) -
      ((35 * E2 ** 3) / 3072) * Math.sin(6 * phi));
  const e = K0 * n * (a + ((1 - t + c) * a ** 3) / 6 + ((5 - 18 * t + t * t + 72 * c - 58 * EP2) * a ** 5) / 120) + 500_000;
  let north =
    K0 *
    (m +
      n * tan * ((a * a) / 2 + ((5 - t + 9 * c + 4 * c * c) * a ** 4) / 24 + ((61 - 58 * t + t * t + 600 * c - 330 * EP2) * a ** 6) / 720));
  if (south) north += 10_000_000;
  return { e, n: north };
}

/** UTM back to latitude and longitude (a few Newton steps on `toUtm`; sub-millimetre near the zone). */
export function fromUtm(e: number, n: number, zone: UtmZone, near: { lat: number; lng: number }): { lat: number; lng: number } {
  let { lat, lng } = near;
  const h = 1e-6;
  for (let k = 0; k < 5; k++) {
    const p = toUtm(lat, lng, zone);
    const pa = toUtm(lat + h, lng, zone);
    const pb = toUtm(lat, lng + h, zone);
    const [a, b, c, d] = [(pa.e - p.e) / h, (pb.e - p.e) / h, (pa.n - p.n) / h, (pb.n - p.n) / h];
    const det = a * d - b * c;
    const [re, rn] = [e - p.e, n - p.n];
    lat += (d * re - b * rn) / det;
    lng += (a * rn - c * re) / det;
  }
  return { lat, lng };
}
