import { currentSession } from "@/lib/server/accounts";
import { dbConfigured } from "@/lib/server/db";
import { imageResponse } from "@/lib/server/design-images";
import { staffTicketPicture } from "@/lib/server/design-support";

/** GET (staff) a picture a business sent with a support ticket. */
export async function GET(_request: Request, ctx: RouteContext<"/api/admin/support/pictures/[id]">) {
  if (!dbConfigured()) return new Response("Not found", { status: 404 });
  const session = await currentSession();
  if (session?.role !== "staff") return new Response("Not found", { status: 404 });
  const { id } = await ctx.params;
  const pic = /^sp_[0-9a-f]{20}$/.test(id) ? await staffTicketPicture(id) : null;
  return pic ? imageResponse(pic) : new Response("Not found", { status: 404 });
}
