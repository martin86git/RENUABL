import { isLiveToken } from "@/lib/domain/design/live";
import { answer, readBody, requireMember } from "@/lib/server/design-context";
import { endLive, liveStatus, pushLive, startLive } from "@/lib/server/design-live-repo";
import { allow } from "@/lib/server/rate-limit";

const gone = () => Response.json({ ok: false, message: "That live link has ended." }, { status: 404 });

/** GET ?token= → { status }: whether the customer is watching, and the design they chose. */
export async function GET(request: Request) {
  return answer(async () => {
    const who = await requireMember("design");
    if ("refuse" in who) return who.refuse;
    const token = new URL(request.url).searchParams.get("token");
    if (!isLiveToken(token)) return gone();
    const status = await liveStatus(who.member.businessId, token);
    return status ? Response.json({ ok: true, status }) : gone();
  });
}

/** POST { lat, lng, jobId? } → { status }: opens the roof's live link for the customer (or the one already open). */
export async function POST(request: Request) {
  return answer(async () => {
    const who = await requireMember("design");
    if ("refuse" in who) return who.refuse;
    const read = await readBody(request, 4_000);
    if ("refuse" in read) return read.refuse;
    const lat = Number(read.body.lat);
    const lng = Number(read.body.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat > -9 || lat < -45 || lng < 112 || lng > 155)
      return Response.json({ ok: false, message: "That roof isn't in Australia." }, { status: 400 });
    if (!allow(request, "design-live-start", 60)) return Response.json({ ok: false, message: "Try again shortly." }, { status: 429 });
    const jobId = typeof read.body.jobId === "string" && read.body.jobId ? read.body.jobId.slice(0, 80) : null;
    const status = await startLive(who.member.businessId, { lat, lng, jobId }, who.member.email);
    return status === "missing"
      ? Response.json({ ok: false, message: "There's no such deal." }, { status: 404 })
      : Response.json({ ok: true, status });
  });
}

/** PUT { token, snapshot }: the design as the customer may see it now. */
export async function PUT(request: Request) {
  return answer(async () => {
    const who = await requireMember("design");
    if ("refuse" in who) return who.refuse;
    const read = await readBody(request, 200_000);
    if ("refuse" in read) return read.refuse;
    if (!isLiveToken(read.body.token)) return gone();
    if (!allow(request, "design-live-push", 3600)) return Response.json({ ok: false, message: "Slow down a little." }, { status: 429 });
    return (await pushLive(who.member.businessId, read.body.token, read.body.snapshot)) ? Response.json({ ok: true }) : gone();
  });
}

/** DELETE { token }: ends the live link. */
export async function DELETE(request: Request) {
  return answer(async () => {
    const who = await requireMember("design");
    if ("refuse" in who) return who.refuse;
    const read = await readBody(request, 2_000);
    if ("refuse" in read) return read.refuse;
    if (!isLiveToken(read.body.token)) return gone();
    await endLive(who.member.businessId, read.body.token);
    return Response.json({ ok: true });
  });
}
