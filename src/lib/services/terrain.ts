/**
 * The heights of everything around a roof (roofs, treetops, the ground), as
 * the designer's shade analysis asks for them. Fetched once for a
 * roof in a visit (the server keeps it for good after its one lookup).
 */
import { unpackTerrain, type Terrain } from "@/lib/domain/design/shade";

const asked = new Map<string, Promise<Terrain | null>>();
const part = (lat: number, lng: number, name: string) => `/api/design/roof/ground?lat=${lat}&lng=${lng}&part=${name}`;

/** The heights for the roof at this place, or null when there are none for it (or they couldn't be fetched just now). */
export function loadTerrain(lat: number, lng: number): Promise<Terrain | null> {
  const key = `${lat},${lng}`;
  const running = asked.get(key);
  if (running) return running;
  const work = fetch(part(lat, lng, "terrain"))
    .then(async (res) => (res.ok ? unpackTerrain(await res.arrayBuffer()) : null))
    .catch(() => null)
    .then((terrain) => {
      // A miss isn't kept: the next ask tries again.
      if (!terrain) asked.delete(key);
      return terrain;
    });
  asked.set(key, work);
  return work;
}
