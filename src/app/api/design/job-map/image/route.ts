import { staticMapUrl } from "@/lib/domain/design/job-map";
import { answer, requireMember } from "@/lib/server/design-context";
import { allow } from "@/lib/server/rate-limit";

/**
 * GET ?lat&lng&zoom: the job map's picture, in its own soft style, fetched here so the Google key never reaches the
 * browser. For a signed-in member only; the view's figures are checked and kept to Australia.
 */
export async function GET(request: Request) {
  return answer(async () => {
    const who = await requireMember("design");
    if ("refuse" in who) return who.refuse;
    if (!allow(request, "design-job-map", 600)) return new Response("Too many maps at once.", { status: 429 });
    const q = new URL(request.url).searchParams;
    const lat = Number(q.get("lat"));
    const lng = Number(q.get("lng"));
    const zoom = Number(q.get("zoom"));
    if (!(lat >= -45 && lat <= -8 && lng >= 110 && lng <= 156 && Number.isInteger(zoom) && zoom >= 3 && zoom <= 18))
      return new Response("That isn't a view of Australia.", { status: 400 });
    const key = process.env.GOOGLE_MAPS_API_KEY?.trim();
    if (!key) return new Response("The map isn't set up on this site.", { status: 503 });
    const res = await fetch(staticMapUrl({ lat, lng, zoom }, key));
    if (!res.ok) return new Response("The map couldn't be drawn just now.", { status: 502 });
    return new Response(await res.arrayBuffer(), {
      headers: { "content-type": res.headers.get("content-type") ?? "image/png", "cache-control": "private, max-age=86400" },
    });
  });
}
