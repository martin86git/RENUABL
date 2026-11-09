/**
 * The heights of everything around a roof (roofs, treetops, the ground), as the designer's slope reading and shade
 * analysis ask for them. Fetched once for a roof in a visit (the server keeps them after its one lookup).
 *
 * While the roof's picture is a Nearmap capture, Nearmap's heights are asked for first (they match the picture, and
 * are often newer than Google's); without them, Google's.
 */
import { unpackTerrain, type Terrain } from "@/lib/domain/design/shade";

/** Heights, with whose they are. */
export type Heights = Terrain & {
  from: "nearmap" | "google";
  /** For Nearmap's: the capture's day (YYYY-MM-DD). */
  captured?: string;
};

const asked = new Map<string, Promise<Heights | null>>();
const at = (lat: number, lng: number) => `lat=${lat}&lng=${lng}`;

async function nearmap(lat: number, lng: number): Promise<Heights | null> {
  const res = await fetch(`/api/design/roof/nearmap/heights?${at(lat, lng)}`, { cache: "no-store" });
  if (!res.ok) return null;
  const terrain = unpackTerrain(await res.arrayBuffer());
  const captured = res.headers.get("x-nearmap-captured") || undefined;
  return terrain ? { ...terrain, from: "nearmap", captured } : null;
}

async function google(lat: number, lng: number): Promise<Heights | null> {
  const res = await fetch(`/api/design/roof/ground?${at(lat, lng)}&part=terrain`);
  if (!res.ok) return null;
  const terrain = unpackTerrain(await res.arrayBuffer());
  return terrain ? { ...terrain, from: "google" } : null;
}

/** The heights for the roof at this place (Nearmap's first when `nearmap`), or null when there are none to be had just now. */
export function loadTerrain(lat: number, lng: number, opts: { nearmap?: boolean } = {}): Promise<Heights | null> {
  const key = `${lat},${lng},${opts.nearmap ? "n" : "g"}`;
  const running = asked.get(key);
  if (running) return running;
  const work = (opts.nearmap ? nearmap(lat, lng).catch(() => null) : Promise.resolve(null))
    .then((found) => found ?? google(lat, lng))
    .catch(() => null)
    .then((heights) => {
      // A miss isn't kept: the next ask tries again.
      if (!heights) asked.delete(key);
      return heights;
    });
  asked.set(key, work);
  return work;
}
