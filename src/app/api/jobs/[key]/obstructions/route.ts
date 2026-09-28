import { designView, framing } from "@/lib/domain/roof-layout";
import { validKey } from "@/lib/server/handover-store";
import { roofData } from "@/lib/server/google-solar";
import { jobLayoutByRecord, partnerOwnsRecord, saveObstructions } from "@/lib/server/jobs-repo";
import { checkObstructions } from "@/lib/server/obstruction-check";
import { portalContext } from "@/lib/server/portal";
import { allow } from "@/lib/server/rate-limit";
import { satelliteImage } from "@/lib/server/roof-view";

/**
 * POST: checks the job's roof for obstructions on its satellite image (for the
 * job's own partner) and saves the result on the job.
 */
export async function POST(request: Request, ctx: RouteContext<"/api/jobs/[key]/obstructions">) {
  const { key } = await ctx.params;
  if (!validKey(key)) return Response.json({ ok: false }, { status: 404 });
  const portal = await portalContext();
  if (portal?.kind !== "partner" || !(await partnerOwnsRecord(portal.partner.id, key)))
    return Response.json({ ok: false }, { status: 404 });
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) return Response.json({ ok: false, message: "The roof check isn't set up yet." }, { status: 503 });
  if (!allow(request, "obstructions", 10)) return Response.json({ ok: false, message: "Try again in a little while." }, { status: 429 });

  const job = await jobLayoutByRecord(key);
  const { lat, lng } = job?.address ?? {};
  if (!job || typeof lat !== "number" || typeof lng !== "number") return Response.json({ ok: false }, { status: 404 });
  const model = (await roofData(lat, lng))?.model;
  const image = await satelliteImage(job.address, "design");
  if (!model || !image) return Response.json({ ok: false, message: "There's no satellite image for this roof." }, { status: 404 });

  const view = designView({ lat, lng });
  const full = view.size * view.scale;
  const f = framing(model, view, 1.8);
  const roofBox = [f.x, f.y, f.x + f.w, f.y + f.h].map((n) => Math.round((n / full) * 1000)) as [number, number, number, number];
  try {
    const check = await checkObstructions(
      { data: await image.arrayBuffer(), mediaType: image.headers.get("content-type")?.includes("png") ? "image/png" : "image/jpeg" },
      roofBox,
      apiKey,
    );
    if (!(await saveObstructions(portal.partner.id, key, check))) return Response.json({ ok: false }, { status: 403 });
    return Response.json({ ok: true, check });
  } catch (e) {
    console.error("obstruction check failed", e instanceof Error ? e.message : e);
    return Response.json({ ok: false, message: "The roof check didn't work just now. Try again." }, { status: 502 });
  }
}
