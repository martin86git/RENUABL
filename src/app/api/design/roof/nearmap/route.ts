import { answer, readBody, requireMember } from "@/lib/server/design-context";
import { chooseImagery, fetchNearmap, roofImagery } from "@/lib/server/design-nearmap-repo";
import { inAustralia } from "@/lib/server/google-solar";
import { nearmapReady, nearmapSurveys } from "@/lib/server/nearmap";
import { allow } from "@/lib/server/rate-limit";

const place = (lat: unknown, lng: unknown) => {
  const p = { lat: Number(lat), lng: Number(lng) };
  return Number.isFinite(p.lat) && Number.isFinite(p.lng) && inAustralia(p.lat, p.lng) ? p : null;
};
const badPlace = () => Response.json({ ok: false, message: "That roof isn't in Australia." }, { status: 400 });

/**
 * GET ?lat=&lng=[&surveys=1] → { ready, use, kept[, surveys] }: the roof's pictures for the designer's picture menu.
 * `surveys` (one Coverage call, no tiles) lists Nearmap's captures there and what each offers with this key.
 */
export async function GET(request: Request) {
  return answer(async () => {
    const who = await requireMember("design");
    if ("refuse" in who) return who.refuse;
    const u = new URL(request.url);
    const p = place(u.searchParams.get("lat"), u.searchParams.get("lng"));
    if (!p) return badPlace();
    const imagery = await roofImagery(who.member.businessId, p.lat, p.lng);
    if (u.searchParams.get("surveys") !== "1" || !nearmapReady()) return Response.json({ ok: true, ready: nearmapReady(), ...imagery });
    if (!allow(request, "nearmap-surveys", 120)) return Response.json({ ok: false, message: "Try again in a minute." }, { status: 429 });
    const surveys = await nearmapSurveys(p.lat, p.lng);
    return Response.json({ ok: true, ready: true, ...imagery, surveys });
  });
}

/** POST { lat, lng, survey? }: fetches Nearmap's picture of the roof (the newest, or that capture), keeps it and uses it. */
export async function POST(request: Request) {
  return answer(async () => {
    const who = await requireMember("design");
    if ("refuse" in who) return who.refuse;
    if (!nearmapReady()) return Response.json({ ok: false, message: "Nearmap isn't set up on RENUABL yet." }, { status: 503 });
    const read = await readBody(request, 2_000);
    if ("refuse" in read) return read.refuse;
    const p = place(read.body.lat, read.body.lng);
    if (!p) return badPlace();
    if (!allow(request, "nearmap-fetch", 30)) return Response.json({ ok: false, message: "Try again in a minute." }, { status: 429 });
    const survey = typeof read.body.survey === "string" && /^[\w-]{1,80}$/.test(read.body.survey) ? read.body.survey : undefined;
    const got = await fetchNearmap(who.member.businessId, p, who.member.email, survey);
    if (got === "none") return Response.json({ ok: false, message: "Nearmap has no picture of this roof." }, { status: 404 });
    if (got === "unknown") return Response.json({ ok: false, message: "Nearmap doesn't list that capture here." }, { status: 404 });
    return Response.json({ ok: true, ...got, ...(await roofImagery(who.member.businessId, p.lat, p.lng)) });
  });
}

/** PUT { lat, lng, use }: puts Google's picture ("google") or a capture already kept in use. Calls no one. */
export async function PUT(request: Request) {
  return answer(async () => {
    const who = await requireMember("design");
    if ("refuse" in who) return who.refuse;
    const read = await readBody(request, 2_000);
    if ("refuse" in read) return read.refuse;
    const p = place(read.body.lat, read.body.lng);
    if (!p) return badPlace();
    const use = typeof read.body.use === "string" ? read.body.use.slice(0, 80) : "";
    if (!(await chooseImagery(who.member.businessId, p, use)))
      return Response.json({ ok: false, message: "That picture isn't kept for this roof." }, { status: 404 });
    return Response.json({ ok: true, ...(await roofImagery(who.member.businessId, p.lat, p.lng)) });
  });
}
