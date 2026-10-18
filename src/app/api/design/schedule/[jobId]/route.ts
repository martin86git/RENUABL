import { systemDetails } from "@/lib/domain/design/deal";
import { installEvent } from "@/lib/domain/design/install-event";
import { siteUrl } from "@/lib/domain/sms";
import type { ISODate } from "@/lib/domain/types";
import { answer, requireMember } from "@/lib/server/design-context";
import { installExtras, jobOrder } from "@/lib/server/design-after-sale-repo";
import { jobById } from "@/lib/server/design-crm-repo";
import { pickupToken } from "@/lib/server/design-pickup-repo";
import { NO_DESIGN, savedFor } from "@/lib/server/design-proposal-repo";

const validId = (id: string) => /^job_[a-f0-9]{8,64}$/.test(id);
const SITE_KEYS = ["distributor", "nmi", "siteAccess", "switchboard"];

/**
 * GET: one booked installation as a calendar event: its title, day and hours, address, and the job sheet (the order's
 * materials, the customer, the system and the site), with a pre-filled Google Calendar link and an .ics file. For the
 * business's own people: the customer's details are theirs to see.
 */
export async function GET(request: Request, ctx: RouteContext<"/api/design/schedule/[jobId]">) {
  return answer(async () => {
    const { jobId } = await ctx.params;
    const who = await requireMember("design");
    if ("refuse" in who) return who.refuse;
    const missing = Response.json({ ok: false, message: "There's no such job." }, { status: 404 });
    if (!validId(jobId)) return missing;
    const found = await jobById(who.member.businessId, jobId);
    if (!found) return missing;
    const { job, customer } = found;
    // The design, when the job has one: its system details come from it, else only from what was typed on the deal.
    const saved = await savedFor(who.member.businessId, who.member.businessName, jobId);
    if (!saved) return missing;
    if (!job.installDate) return Response.json({ ok: false, message: "This job has no installation date yet." }, { status: 409 });
    const design = saved === NO_DESIGN ? null : saved.project.set.designs[saved.project.set.primary];
    const form = saved === NO_DESIGN ? null : saved.project.extras.quotes[saved.project.set.primary].form;
    const details = systemDetails(design, form, job.details).filter((d) => d.value);
    const order = await jobOrder(who.member.businessId, jobId);
    const extra = (await installExtras(who.member.businessId)).find((e) => e.jobId === jobId);
    const site = siteUrl() ?? new URL(request.url).origin;
    // The pickup slip's private link, made once: the installer opens it at the counter with no sign-in.
    const slip = typeof order === "string" ? null : `${site}/pickup/${await pickupToken(who.member.businessId, jobId)}`;
    const event = installEvent({
      business: saved === NO_DESIGN ? who.member.businessName : saved.brand.name || who.member.businessName,
      jobId,
      date: job.installDate as ISODate,
      customer: { name: customer.name, phone: customer.phone },
      address: job.address || customer.address,
      kw: job.kw,
      batteryKwh: extra?.batteryKwh ?? 0,
      storeys: details.find((d) => d.key === "storeys")?.value ?? null,
      installer: job.details?.installer ?? null,
      // Each wholesaler on the order with its SO number, and every item with the part it is for and where it comes from.
      pickups:
        typeof order === "string"
          ? []
          : order.groups.flatMap((g) =>
              g.list && g.supplier ? [{ supplier: g.supplier, so: order.order.salesOrders?.[g.list] ?? "" }] : [],
            ),
      items:
        typeof order === "string"
          ? []
          : order.items.filter((i) => !i.off).map((i) => ({ part: i.group, qty: i.qty, item: i.item, sku: i.sku, supplier: i.supplier })),
      details: details.map((d) => ({ key: d.key, label: d.label, value: d.value! })),
      site: details.filter((d) => SITE_KEYS.includes(d.key)).map((d) => ({ label: d.label, value: d.value! })),
      reference: typeof order === "string" ? "" : order.order.reference,
      slip,
    });
    // Never the customer's email: this is the installer's sheet, and no one is invited by it.
    return Response.json({ ok: true, event, customer: { name: customer.name, phone: customer.phone } });
  });
}
