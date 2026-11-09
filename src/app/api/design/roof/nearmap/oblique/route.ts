import { requireMember } from "@/lib/server/design-context";
import { inAustralia } from "@/lib/server/google-solar";
import { OBLIQUE_VIEWS, nearmapOblique, nearmapReady, type ObliqueView } from "@/lib/server/nearmap";
import { allow } from "@/lib/server/rate-limit";

export const maxDuration = 60;

/** Pictures made lately, so turning between the sides doesn't ask Nearmap again (each is some nine tiles). */
const made = new Map<string, { jpeg: Buffer; captured: string } | null>();

/**
 * GET ?lat=&lng=&view=North|East|South|West: Nearmap's angled photo of the roof from that side (JPEG, 800 × 600), with
 * the capture's day in `x-nearmap-captured`. For a signed-in member; the key stays on the server. 404 when there is none.
 */
export async function GET(request: Request) {
  const who = await requireMember("design");
  if ("refuse" in who) return who.refuse;
  if (!nearmapReady()) return new Response(null, { status: 503 });
  const u = new URL(request.url);
  const lat = Number(u.searchParams.get("lat"));
  const lng = Number(u.searchParams.get("lng"));
  const view = u.searchParams.get("view") as ObliqueView | null;
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || !inAustralia(lat, lng) || !view || !(view in OBLIQUE_VIEWS))
    return new Response(null, { status: 400 });
  if (!allow(request, "nearmap-oblique", 240)) return new Response(null, { status: 429 });
  const key = `${lat.toFixed(6)},${lng.toFixed(6)},${view}`;
  let got = made.get(key);
  if (got === undefined) {
    got = await nearmapOblique(lat, lng, view).catch(() => null);
    made.set(key, got);
    if (made.size > 60) made.delete(made.keys().next().value!);
  }
  if (!got) return new Response(null, { status: 404 });
  return new Response(new Uint8Array(got.jpeg), {
    headers: { "content-type": "image/jpeg", "cache-control": "private, max-age=86400", "x-nearmap-captured": got.captured },
  });
}
