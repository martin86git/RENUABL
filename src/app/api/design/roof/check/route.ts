import { answer, requireMember } from "@/lib/server/design-context";
import { roofCheck } from "@/lib/server/design-roof-check";
import { inAustralia } from "@/lib/server/google-solar";
import { allow } from "@/lib/server/rate-limit";

export const maxDuration = 60;

/**
 * POST {lat, lng} → { ok, check }: what is already on the roof in the picture in use (existing panels, vents,
 * skylights), set on the roof in metres, for Design it for me and Fit to keep clear of. Asked of Claude once a picture,
 * then kept (`check` null when it can't be asked: no picture, or Claude isn't set up). Takes no Sol credit.
 */
export async function POST(request: Request) {
  return answer(async () => {
    const who = await requireMember("design");
    if ("refuse" in who) return who.refuse;
    const body = (await request.json().catch(() => ({}))) as { lat?: unknown; lng?: unknown };
    const p = { lat: Number(body.lat), lng: Number(body.lng) };
    if (!Number.isFinite(p.lat) || !Number.isFinite(p.lng) || !inAustralia(p.lat, p.lng))
      return Response.json({ ok: false, message: "That roof isn't in Australia." }, { status: 400 });
    if (!allow(request, "design-roof-check", 60)) return Response.json({ ok: false, message: "Try again in a minute." }, { status: 429 });
    const check = await roofCheck(who.member.businessId, p).catch((e) => {
      console.error("roof check failed", e instanceof Error ? e.message : e);
      return null;
    });
    return Response.json({ ok: true, check });
  });
}
