import { requireMember } from "@/lib/server/design-context";
import { keptPicture } from "@/lib/server/design-nearmap-repo";

/** GET ?lat=&lng=&survey=: a Nearmap picture the business kept for this roof (1280 × 800, the designer's window). */
export async function GET(request: Request) {
  const who = await requireMember("design");
  if ("refuse" in who) return who.refuse;
  const u = new URL(request.url);
  const lat = Number(u.searchParams.get("lat"));
  const lng = Number(u.searchParams.get("lng"));
  const survey = u.searchParams.get("survey") ?? "";
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || !/^[\w-]{1,80}$/.test(survey)) return new Response(null, { status: 400 });
  const bytes = await keptPicture(who.member.businessId, lat, lng, survey).catch(() => null);
  if (!bytes) return new Response(null, { status: 404 });
  return new Response(new Uint8Array(bytes), {
    headers: { "content-type": "image/jpeg", "cache-control": "private, max-age=86400" },
  });
}
