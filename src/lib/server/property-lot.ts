/**
 * Server only. The lot an address is registered to, from Victoria's open land register (Vicmap Address and Vicmap
 * Property: public, no key, CC BY 4.0, © State of Victoria), for the designer's "Is this the home?" (see
 * `domain/design/property-lot.ts`). It only reads, sends the state's server a spot on the map and nothing about the
 * customer, and a failure never holds the designer up: without it there is no outline and Sol skips the question.
 */
import { inside } from "@/lib/domain/design/roof-design";
import { matchAddress, nearbyHomes, onPicture, type PropertyLot, type RegisteredAddress } from "@/lib/domain/design/property-lot";

const WFS = "https://opendata.maps.vic.gov.au/geoserver/wfs";

interface Feature {
  geometry: { type: string; coordinates: unknown } | null;
  properties: Record<string, string | number | null>;
}

async function features(layer: string, filter: string, fields?: string): Promise<Feature[]> {
  const url = new URL(WFS);
  url.searchParams.set("service", "WFS");
  url.searchParams.set("version", "2.0.0");
  url.searchParams.set("request", "GetFeature");
  url.searchParams.set("outputFormat", "application/json");
  url.searchParams.set("srsName", "EPSG:4326");
  url.searchParams.set("typeNames", `open-data-platform:${layer}`);
  url.searchParams.set("cql_filter", filter);
  url.searchParams.set("count", "300");
  if (fields) url.searchParams.set("propertyName", fields);
  const res = await fetch(url, { signal: AbortSignal.timeout(8_000), next: { revalidate: 86_400 } });
  if (!res.ok) throw new Error(`Vicmap ${layer} ${res.status}`);
  return ((await res.json()) as { features?: Feature[] }).features ?? [];
}

const coordinate = (n: number) => n.toFixed(6);
const text = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : undefined);

/**
 * The lot for an address, given where the map shows it: the register's own entry for the address among those within
 * about 150 metres, and the lot under it (or under the middle of the picture when the address isn't there). Null when
 * the register can't be reached or has no lot there.
 */
export async function propertyLot(address: string, spot: { lat: number; lng: number }): Promise<PropertyLot | null> {
  try {
    const reach = 0.0014;
    // The register's filters take a point as "latitude longitude"; what comes back is longitude first.
    const box = [spot.lat - reach, spot.lng - reach * 1.3, spot.lat + reach, spot.lng + reach * 1.3].map(coordinate).join(",");
    const nearby: RegisteredAddress[] = (
      await features(
        "address",
        `BBOX(geom,${box})`,
        "ezi_address,num_road_address,locality_name,postcode,house_number_1,road_name,blg_unit_id_1,property_pfi,geom",
      )
    ).flatMap((f) => {
      const at = f.geometry?.type === "Point" ? (f.geometry.coordinates as number[]) : null;
      if (!at) return [];
      const p = f.properties;
      return [
        {
          text: String(p.ezi_address ?? ""),
          street: text(p.num_road_address),
          suburb: text(p.locality_name),
          postcode: text(p.postcode),
          number: typeof p.house_number_1 === "number" ? p.house_number_1 : null,
          road: typeof p.road_name === "string" ? p.road_name : null,
          unit: typeof p.blg_unit_id_1 === "number" ? p.blg_unit_id_1 : null,
          lot: text(p.property_pfi),
          lng: at[0],
          lat: at[1],
        },
      ];
    });
    const registered = matchAddress(address, nearby, spot);
    const at = registered ?? spot;
    const lots = await features("property_view", `INTERSECTS(geom,POINT(${coordinate(at.lat)} ${coordinate(at.lng)}))`);
    const shape = lots[0]?.geometry;
    if (!shape) return null;
    const pieces = (
      shape.type === "MultiPolygon" ? shape.coordinates : shape.type === "Polygon" ? [shape.coordinates] : []
    ) as number[][][][];
    // Each piece's outer boundary (holes in a lot are rare and don't help find the house).
    const outlines = pieces
      .map((piece) => (piece[0] ?? []).slice(0, 200).map(([lng, lat]) => onPicture({ lat, lng }, spot)))
      .filter((outline) => outline.length >= 3)
      .slice(0, 4);
    if (!outlines.length) return null;
    // The lot outlined, by the register's own number for it, so the homes offered leave it out.
    const outlined = registered ?? nearby.find((a) => outlines.some((o) => inside(onPicture(a, spot), o))) ?? null;
    return {
      outlines,
      registered: registered?.text || null,
      pinOnLot: outlines.some((outline) => inside({ x: 0, y: 0 }, outline)),
      nearby: nearbyHomes(nearby, spot, outlined),
    };
  } catch (e) {
    console.error("property lot lookup failed", e instanceof Error ? e.message : e);
    return null;
  }
}

/** Kept while the server is warm: a lot's boundary doesn't change. Only a found lot is kept (a miss may be the register down). */
const kept = new Map<string, PropertyLot>();

export async function keptPropertyLot(address: string, spot: { lat: number; lng: number }): Promise<PropertyLot | null> {
  const key = `${address.trim().toLowerCase()}|${spot.lat.toFixed(5)},${spot.lng.toFixed(5)}`;
  const had = kept.get(key);
  if (had) return had;
  const lot = await propertyLot(address, spot);
  if (lot) {
    if (kept.size > 500) kept.delete(kept.keys().next().value as string);
    kept.set(key, lot);
  }
  return lot;
}
