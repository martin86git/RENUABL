/**
 * Google's roof model for a place (each roof face's direction and pitch, and
 * every spot a panel fits), as the roof designer asks for it. Fetched once
 * for a roof in a visit (the server keeps it after its one lookup).
 */
import type { RoofModel } from "@/lib/domain/roof-layout";

const asked = new Map<string, Promise<RoofModel | null>>();

/** The roof model at this place, or null when there is none (or it couldn't be fetched just now). */
export function loadRoofModel(lat: number, lng: number): Promise<RoofModel | null> {
  const key = `${lat},${lng}`;
  const running = asked.get(key);
  if (running) return running;
  const work = fetch(`/api/roof?lat=${lat}&lng=${lng}`)
    .then((res) => res.json() as Promise<{ ok?: boolean; model?: RoofModel | null }>)
    .then((json) => (json.ok && json.model?.slots?.length ? json.model : null))
    .catch(() => null)
    .then((model) => {
      // A miss isn't kept: the next ask tries again.
      if (!model) asked.delete(key);
      return model;
    });
  asked.set(key, work);
  return work;
}
