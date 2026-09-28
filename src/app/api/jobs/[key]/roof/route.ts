import { isRoofViewSize } from "@/lib/domain/roof-view";
import { validKey } from "@/lib/server/handover-store";
import { roofViewFor } from "@/lib/server/roof-view";

/** GET ?size=wide|thumb: the satellite view of the job's roof, for the job's own partner. 404 otherwise. */
export async function GET(request: Request, ctx: RouteContext<"/api/jobs/[key]/roof">) {
  const { key } = await ctx.params;
  const size = new URL(request.url).searchParams.get("size") ?? "wide";
  if (!validKey(key) || !isRoofViewSize(size)) return new Response(null, { status: 404 });
  try {
    return (await roofViewFor(key, size)) ?? new Response(null, { status: 404 });
  } catch (e) {
    console.error("roof view failed", e instanceof Error ? e.message : e);
    return new Response(null, { status: 502 });
  }
}
