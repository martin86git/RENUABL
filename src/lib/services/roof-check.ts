/**
 * What is already on a roof (existing panels, vents, skylights), for the designer to keep clear of: asked once a
 * roof and picture in a visit (the server keeps it after its one look). Null when it can't be had (signed out, no
 * picture, or the check isn't set up): the designer then designs as before.
 */
import type { RoofCheck } from "@/lib/domain/design/roof-check";

const asked = new Map<string, Promise<RoofCheck | null>>();

export function loadRoofCheck(lat: number, lng: number, picture: string): Promise<RoofCheck | null> {
  const key = `${lat},${lng},${picture}`;
  const running = asked.get(key);
  if (running) return running;
  const work = fetch("/api/design/roof/check", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ lat, lng }),
  })
    .then(async (res) => (res.ok ? (((await res.json()) as { check?: RoofCheck | null }).check ?? null) : null))
    .catch(() => null)
    .then((check) => {
      if (!check) asked.delete(key);
      return check;
    });
  asked.set(key, work);
  return work;
}
