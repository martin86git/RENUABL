import { validKey } from "@/lib/server/handover-store";
import { mapTilesKey } from "@/lib/server/map-tiles";
import { ownedJobAddress } from "@/lib/server/roof-view";

/** GET ?record=: the 3D tiles key, for the job's partner or the homeowner only. */
export async function GET(request: Request) {
  const record = new URL(request.url).searchParams.get("record") ?? "";
  const key = mapTilesKey();
  if (!key || !validKey(record) || !(await ownedJobAddress(record))) return Response.json({ ok: false }, { status: 404 });
  return Response.json({ ok: true, key }, { headers: { "cache-control": "private, no-store" } });
}
