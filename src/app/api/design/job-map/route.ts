import { INSTALLED_STAGES, PRE_INSTALL_STAGES } from "@/lib/domain/design/crm";
import { cleanJobPlaces } from "@/lib/domain/design/job-map";
import { supplierLabel } from "@/lib/domain/design/prefs";
import { answer, readBody, requireMember } from "@/lib/server/design-context";
import { listOrders, loadPrefs, savePrefs } from "@/lib/server/design-after-sale-repo";
import { listJobs } from "@/lib/server/design-crm-repo";
import { loadLists } from "@/lib/server/design-repo";

/**
 * GET: the job map's data: every sold job with a place on the map (the whole team's, as the Install Scheduler is), each
 * with the wholesalers on its order; the base and each collection point; and every wholesaler on the price lists, to
 * mark one. Never a price.
 */
export async function GET() {
  return answer(async () => {
    const who = await requireMember("design");
    if ("refuse" in who) return who.refuse;
    const id = who.member.businessId;
    const [jobs, orders, prefs, lists] = await Promise.all([listJobs(id), listOrders(id), loadPrefs(id), loadLists(id)]);
    const onOrder = new Map(orders.map((o) => [o.jobId, o.suppliers.filter((s) => s !== "No supplier on file")]));
    const sold = [...PRE_INSTALL_STAGES, ...INSTALLED_STAGES];
    return Response.json({
      ok: true,
      jobs: jobs
        .filter((j) => sold.includes(j.stage) && j.lat !== null && j.lng !== null)
        .map((j) => ({
          id: j.id,
          customer: j.customerName,
          address: j.address,
          lat: j.lat,
          lng: j.lng,
          stage: j.stage,
          installDate: j.installDate,
          kw: j.kw,
          installer: j.details?.installer ?? null,
          wholesalers: [...new Set(onOrder.get(j.id) ?? [])],
        })),
      places: prefs.places,
      wholesalers: [...new Set([...lists.map((l) => supplierLabel(prefs, l.name)), ...Object.keys(prefs.places.collection)])],
    });
  });
}

/** PUT { places }: the base and collection points, cleaned here and kept with the business's settings. */
export async function PUT(request: Request) {
  return answer(async () => {
    const who = await requireMember("prices");
    if ("refuse" in who) return who.refuse;
    const read = await readBody(request, 20_000);
    if ("refuse" in read) return read.refuse;
    const prefs = await loadPrefs(who.member.businessId);
    const saved = await savePrefs(who.member.businessId, { ...prefs, places: cleanJobPlaces(read.body.places) }, who.member.email);
    return Response.json({ ok: true, places: saved.places });
  });
}
