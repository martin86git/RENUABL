import { answer, requireMember } from "@/lib/server/design-context";
import { nearmapOutline } from "@/lib/server/design-nearmap-repo";
import { inAustralia } from "@/lib/server/google-solar";
import { nearmapReady } from "@/lib/server/nearmap";
import { allow } from "@/lib/server/rate-limit";

/**
 * GET ?lat=&lng= → { points, captured }: the home's roof outline in the Nearmap capture this roof uses, in the
 * designer's frame, to be put down as a traced face (`points` null when Nearmap drew no roof at the address). Asked of
 * Nearmap once a capture (it uses the plan's AI credits), then kept.
 */
export async function GET(request: Request) {
  return answer(async () => {
    const who = await requireMember("design");
    if ("refuse" in who) return who.refuse;
    if (!nearmapReady()) return Response.json({ ok: false, message: "Nearmap isn't set up on RENUABL yet." }, { status: 503 });
    const u = new URL(request.url);
    const p = { lat: Number(u.searchParams.get("lat")), lng: Number(u.searchParams.get("lng")) };
    if (!Number.isFinite(p.lat) || !Number.isFinite(p.lng) || !inAustralia(p.lat, p.lng))
      return Response.json({ ok: false, message: "That roof isn't in Australia." }, { status: 400 });
    if (!allow(request, "nearmap-outline", 60)) return Response.json({ ok: false, message: "Try again in a minute." }, { status: 429 });
    const got = await nearmapOutline(who.member.businessId, p);
    if (got === "google")
      return Response.json(
        { ok: false, message: "Choose a Nearmap picture first: the outline is drawn from that capture." },
        { status: 409 },
      );
    if (got === "unreached")
      return Response.json({ ok: false, message: "Nearmap couldn't be reached. Try again in a moment." }, { status: 502 });
    return Response.json({ ok: true, ...got });
  });
}
