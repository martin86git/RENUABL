import { dbConfigured } from "@/lib/server/db";
import { currentPrices } from "@/lib/server/prices-repo";

/** GET: the supplier prices imported by staff (by SKU, cost ex GST), used for every price on the site. */
export async function GET() {
  if (!dbConfigured()) return Response.json({ costs: {}, updatedAt: null });
  try {
    return Response.json(await currentPrices(), { headers: { "cache-control": "public, max-age=60, s-maxage=60" } });
  } catch (e) {
    console.error("prices lookup failed", e instanceof Error ? e.message : e);
    return Response.json({ costs: {}, updatedAt: null });
  }
}
