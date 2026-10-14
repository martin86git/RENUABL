/**
 * The heights of everything around a roof (roofs, treetops, the ground), as
 * the designer's shade analysis and 3D view ask for them. Fetched once for a
 * roof in a visit (the server keeps it for good after its one lookup).
 */
import { cleanScene, type Scene } from "@/lib/domain/design/scene";
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

const scenes = new Map<string, Promise<Scene | null>>();

/** The buildings and trees around the roof at this place as clean shapes, for the 3D view; null when there is no data for it. */
export function loadScene(lat: number, lng: number): Promise<Scene | null> {
  const key = `${lat},${lng}`;
  const running = scenes.get(key);
  if (running) return running;
  const work = fetch(part(lat, lng, "scene"))
    .then(async (res) => (res.ok ? cleanScene(await res.json()) : null))
    .catch(() => null)
    .then((scene) => {
      if (!scene) scenes.delete(key);
      return scene;
    });
  scenes.set(key, work);
  return work;
}

/** Where the pictures that go with the heights are: the plain drawing of the ground, and Google's own aerial photo. */
export const groundPictures = (lat: number, lng: number) => ({
  drawing: `/api/design/roof/ground?lat=${lat}&lng=${lng}`,
  aerial: part(lat, lng, "aerial"),
});
