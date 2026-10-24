/**
 * The job map, from the installer's side (24 Oct 2026, Martin: an Apple Maps style map of where each job is, where the
 * base is, and where the stock is collected). A business marks its base and each wholesaler's collection point; the map
 * fits them and its sold jobs, in a soft style of its own; a job picked shows its run: base, the wholesalers on its
 * order, then the job, with the distances as the crow flies and a directions link through every stop. Pure, tested.
 */

export interface Place {
  address: string;
  lat: number;
  lng: number;
}
export interface JobPlaces {
  base: Place | null;
  /** By the wholesaler's name as it reads on an order ("AWM Clayton"). */
  collection: Record<string, Place>;
}
export const NO_PLACES: JobPlaces = { base: null, collection: {} };
export const MAX_COLLECTION_POINTS = 20;

/** A place as kept: an address and both figures, inside Australia; else null. */
export function cleanPlace(raw: unknown): Place | null {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const lat = Number(r.lat);
  const lng = Number(r.lng);
  const address =
    typeof r.address === "string"
      ? r.address
          .replace(/[\u0000-\u001f\u007f]/g, " ")
          .trim()
          .slice(0, 200)
      : "";
  if (!address || !Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat < -44 || lat > -9 || lng < 112 || lng > 154) return null;
  return { address, lat: Math.round(lat * 1e6) / 1e6, lng: Math.round(lng * 1e6) / 1e6 };
}

export function cleanJobPlaces(raw: unknown): JobPlaces {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const given = r.collection && typeof r.collection === "object" ? (r.collection as Record<string, unknown>) : {};
  const collection: Record<string, Place> = {};
  for (const [name, value] of Object.entries(given).slice(0, MAX_COLLECTION_POINTS)) {
    const key = name
      .replace(/[\u0000-\u001f\u007f]/g, " ")
      .trim()
      .slice(0, 80);
    const place = cleanPlace(value);
    if (key && place) collection[key] = place;
  }
  return { base: cleanPlace(r.base), collection };
}

// ---------------------------------------------------------------------------
// The map
// ---------------------------------------------------------------------------

/** The map's picture: Google's static map at these CSS pixels (drawn at twice that for sharp screens). */
export const MAP_SIZE = { w: 640, h: 480 } as const;

export interface MapView {
  lat: number;
  lng: number;
  zoom: number;
}

const world = (lat: number, lng: number, zoom: number) => {
  const size = 256 * 2 ** zoom;
  const s = Math.min(Math.max(Math.sin((lat * Math.PI) / 180), -0.9999), 0.9999);
  return { x: ((lng + 180) / 360) * size, y: (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * size };
};

/** Where a place falls on the map's picture, in its CSS pixels from the top left. */
export function project(lat: number, lng: number, view: MapView, size: { w: number; h: number } = MAP_SIZE) {
  const c = world(view.lat, view.lng, view.zoom);
  const p = world(lat, lng, view.zoom);
  return { x: size.w / 2 + (p.x - c.x), y: size.h / 2 + (p.y - c.y) };
}

/**
 * The view that holds every point with room around it: centred on them, at the closest zoom (no closer than 15) that
 * fits. One point is shown at street level; none, at Melbourne.
 */
export function fitView(points: readonly { lat: number; lng: number }[], size: { w: number; h: number } = MAP_SIZE, pad = 56): MapView {
  if (!points.length) return { lat: -37.8136, lng: 144.9631, zoom: 9 };
  const lats = points.map((p) => p.lat);
  const lngs = points.map((p) => p.lng);
  const centre = { lat: (Math.min(...lats) + Math.max(...lats)) / 2, lng: (Math.min(...lngs) + Math.max(...lngs)) / 2 };
  for (let zoom = 15; zoom >= 3; zoom--) {
    const view = { ...centre, zoom };
    if (
      points.every((p) => {
        const at = project(p.lat, p.lng, view, size);
        return at.x >= pad && at.x <= size.w - pad && at.y >= pad && at.y <= size.h - pad;
      })
    )
      return view;
  }
  return { ...centre, zoom: 3 };
}

/** The distance between two places as the crow flies, in km. */
export function crowKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371;
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export interface Stop {
  kind: "base" | "collect" | "job";
  label: string;
  place: Place;
}

/**
 * A job's run: from the base (when marked), by each wholesaler on its order that has a collection point (nearest first
 * from wherever the run is), to the job. The wholesalers without a point are named in `unplaced`.
 */
export function runFor(
  job: { label: string; place: Place; wholesalers: readonly string[] },
  places: JobPlaces,
): { stops: Stop[]; unplaced: string[] } {
  const start: Stop[] = places.base ? [{ kind: "base", label: "Base", place: places.base }] : [];
  const left = job.wholesalers
    .filter((w) => places.collection[w])
    .map((w) => ({ kind: "collect" as const, label: w, place: places.collection[w] }));
  const stops = [...start];
  let at = start[0]?.place ?? job.place;
  while (left.length) {
    left.sort((a, b) => crowKm(at, a.place) - crowKm(at, b.place));
    const next = left.shift()!;
    stops.push(next);
    at = next.place;
  }
  stops.push({ kind: "job", label: job.label, place: job.place });
  return { stops, unplaced: job.wholesalers.filter((w) => !places.collection[w]) };
}

/** Each leg's distance and the whole run's, rounded to the km (one decimal under 10 km). */
export function runKm(stops: readonly Stop[]): { legs: number[]; total: number } {
  const round = (km: number) => (km < 10 ? Math.round(km * 10) / 10 : Math.round(km));
  const legs = stops.slice(1).map((s, i) => crowKm(stops[i].place, s.place));
  return { legs: legs.map(round), total: round(legs.reduce((n, k) => n + k, 0)) };
}

/** Google Maps directions through every stop, in order, for driving. */
export function directionsUrl(stops: readonly Stop[]): string | null {
  if (stops.length < 2) return null;
  const at = (p: Place) => `${p.lat},${p.lng}`;
  const params = new URLSearchParams({
    api: "1",
    origin: at(stops[0].place),
    destination: at(stops[stops.length - 1].place),
    travelmode: "driving",
  });
  if (stops.length > 2)
    params.set(
      "waypoints",
      stops
        .slice(1, -1)
        .map((s) => at(s.place))
        .join("|"),
    );
  return `https://www.google.com/maps/dir/?${params.toString()}`;
}

/**
 * The map's look, in Google's static map styles: soft and quiet, as Apple's maps are: warm land, white roads, highways a
 * pale gold, water a soft blue, parks a soft green, places and transit left out, labels grey.
 */
export const MAP_STYLE: readonly string[] = [
  "element:geometry|color:0xf3f1ec",
  "element:labels.icon|visibility:off",
  "element:labels.text.fill|color:0x86837d",
  "element:labels.text.stroke|color:0xf3f1ec",
  "feature:administrative|element:geometry|visibility:off",
  "feature:administrative.locality|element:labels.text.fill|color:0x5f5c57",
  "feature:poi|visibility:off",
  "feature:poi.park|visibility:on",
  "feature:poi.park|element:geometry|color:0xdcebd3",
  "feature:poi.park|element:labels|visibility:off",
  "feature:landscape.natural|element:geometry|color:0xe9eee2",
  "feature:road|element:geometry|color:0xffffff",
  "feature:road|element:geometry.stroke|color:0xe6e3dc",
  "feature:road.highway|element:geometry|color:0xf7e1a8",
  "feature:road.highway|element:geometry.stroke|color:0xeccd7f",
  "feature:road.local|element:labels|visibility:off",
  "feature:transit|visibility:off",
  "feature:water|element:geometry|color:0xbcd9ec",
  "feature:water|element:labels.text.fill|color:0x7fa3bd",
];

/** The static map's address for a view, in the map's style. Built on the server: the key never reaches the browser. */
export function staticMapUrl(view: MapView, key: string, size: { w: number; h: number } = MAP_SIZE): string {
  const params = new URLSearchParams({
    center: `${view.lat.toFixed(6)},${view.lng.toFixed(6)}`,
    zoom: String(view.zoom),
    size: `${size.w}x${size.h}`,
    scale: "2",
    format: "png",
    key,
  });
  for (const s of MAP_STYLE) params.append("style", s);
  return `https://maps.googleapis.com/maps/api/staticmap?${params.toString()}`;
}
