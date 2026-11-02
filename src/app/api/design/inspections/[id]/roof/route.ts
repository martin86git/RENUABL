import { answer, requireMember } from "@/lib/server/design-context";
import { inspectionRoof } from "@/lib/server/design-inspections-repo";
import { satelliteImage } from "@/lib/server/roof-view";

/** GET: the roof picture the job's drawings are drawn on, for the inspector of a live inspection. */
export async function GET(_request: Request, ctx: RouteContext<"/api/design/inspections/[id]/roof">) {
  return answer(async () => {
    const who = await requireMember("design");
    if ("refuse" in who) return who.refuse;
    const { id } = await ctx.params;
    const roof = await inspectionRoof(who.member.businessId, id.slice(0, 60));
    if (!roof) return new Response(null, { status: 404 });
    try {
      return (
        (await satelliteImage({ line: roof.address, suburb: "", state: "", postcode: "", lat: roof.lat, lng: roof.lng }, "designer")) ??
        new Response(null, { status: 404 })
      );
    } catch {
      return new Response(null, { status: 502 });
    }
  });
}
