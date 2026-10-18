/**
 * Google's roof model for a place (each roof face's direction and pitch, and
 * every spot a panel fits), as the roof designer asks for it, and whether it
 * lines up with today's photo. Each fetched once for a roof in a visit (the
 * server keeps them after its one lookup).
 */
import type { RoofModel } from "@/lib/domain/roof-layout";

/** Where the server draws the satellite photo so it lines up with Google Solar's (its own pixels, at 2x). */
type SatelliteShift = { x: number; y: number };

export interface RoofInfo {
  model: RoofModel | null;
  /** When Google photographed the roof its model was measured on ("2018-12"), when it says. */
  imageryDate: string | null;
}

const asked = new Map<string, Promise<RoofInfo>>();

/** The roof model at this place, and when it was photographed. A miss (no data, or not reachable just now) is asked again next time. */
export function loadRoofInfo(lat: number, lng: number): Promise<RoofInfo> {
  const key = `${lat},${lng}`;
  const running = asked.get(key);
  if (running) return running;
  const work = fetch(`/api/roof?lat=${lat}&lng=${lng}`)
    .then((res) => res.json() as Promise<{ ok?: boolean; model?: RoofModel | null; roof?: { imageryDate?: string } | null }>)
    .then((json) => ({
      model: json.ok && json.model?.slots?.length ? json.model : null,
      imageryDate: typeof json.roof?.imageryDate === "string" ? json.roof.imageryDate : null,
    }))
    .catch(() => ({ model: null, imageryDate: null }))
    .then((info) => {
      if (!info.model) asked.delete(key);
      return info;
    });
  asked.set(key, work);
  return work;
}

/** The roof model at this place, or null when there is none (or it couldn't be fetched just now). */
export function loadRoofModel(lat: number, lng: number): Promise<RoofModel | null> {
  return loadRoofInfo(lat, lng).then((info) => info.model);
}

/**
 * Whether Google's model lines up with the designer's photo: `aligned` with the shift that puts it in place
 * (`modelOffset` turns it into metres), `mismatch` when Google's own photo of the roof and today's don't match
 * (often a roof that has changed since), or `unknown` when there is nothing to compare with.
 */
export type ModelFit = { kind: "aligned"; shift: SatelliteShift } | { kind: "mismatch" } | { kind: "unknown" };

const fits = new Map<string, Promise<ModelFit>>();

export function loadModelFit(lat: number, lng: number): Promise<ModelFit> {
  const key = `${lat},${lng}`;
  const running = fits.get(key);
  if (running) return running;
  const work = fetch(`/api/roof/photo?lat=${lat}&lng=${lng}&frame=1`)
    .then(async (res): Promise<ModelFit> => {
      if (!res.ok) return { kind: "unknown" };
      const json = (await res.json()) as { ok?: boolean; shift?: SatelliteShift | null };
      if (!json.ok) return { kind: "unknown" };
      return json.shift ? { kind: "aligned", shift: json.shift } : { kind: "mismatch" };
    })
    .catch((): ModelFit => ({ kind: "unknown" }))
    .then((fit) => {
      if (fit.kind === "unknown") fits.delete(key);
      return fit;
    });
  fits.set(key, work);
  return work;
}
