import { getRebateRates } from "@/lib/server/rebate-rates";

/** GET → today's rebate rules (live from the CER and Solar Victoria where possible). */
export async function GET() {
  const { rates, problems } = await getRebateRates();
  return Response.json({ rates, problems }, { headers: { "cache-control": "public, s-maxage=3600, stale-while-revalidate=86400" } });
}
