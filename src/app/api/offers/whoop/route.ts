import { whoopOpen } from "@/lib/server/whoop-repo";

export const dynamic = "force-dynamic";

/** GET → { open }: whether the October WHOOP offer still has claims left (never the count). */
export async function GET() {
  return Response.json({ open: await whoopOpen() }, { headers: { "cache-control": "public, max-age=60" } });
}
