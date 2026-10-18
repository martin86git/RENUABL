import { systemDetails } from "@/lib/domain/design/deal";
import { installEvent } from "@/lib/domain/design/install-event";
import { siteUrl } from "@/lib/domain/sms";
import type { ISODate } from "@/lib/domain/types";
import { answer, requireMember } from "@/lib/server/design-context";
import { installExtras, jobOrder } from "@/lib/server/design-after-sale-repo";
import { jobById } from "@/lib/server/design-crm-repo";
import { NO_DESIGN, savedFor } from "@/lib/server/design-proposal-repo";

const validId = (id: string) => /^job_[a-f0-9]{8,64}$/.test(id);
const SITE_KEYS = ["distributor", "nmi", "siteAccess", "switchboard"];
const SHOWN = [
  "systemType",
  "systemSize",
  "panel",
  "panelQty",
  "optimisers",
  "inverter",
  "inverterQty",
  "additionalInverter",
  "battery",
  "batteryQty",
  "batteryStorage",
  "evCharger",
  "roofType",
  "storeys",
  "phases",
  "tiltFrames",
];

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
    const event = installEvent({
      business: saved === NO_DESIGN ? who.member.businessName : saved.brand.name || who.member.businessName,
      jobId,
      date: job.installDate as ISODate,
      customer: { name: customer.name, email: customer.email, phone: customer.phone },
      address: job.address || customer.address,
      kw: job.kw,
      batteryKwh: extra?.batteryKwh ?? 0,
      storeys: details.find((d) => d.key === "storeys")?.value ?? null,
      installer: job.details?.installer ?? null,
      system: details.filter((d) => SHOWN.includes(d.key)).map((d) => ({ label: d.label, value: d.value! })),
      materials: typeof order === "string" ? [] : order.items.filter((i) => !i.off).map((i) => ({ qty: i.qty, item: i.item, sku: i.sku })),
      site: details.filter((d) => SITE_KEYS.includes(d.key)).map((d) => ({ label: d.label, value: d.value! })),
      link: `${site}/design/deals/${jobId}`,
    });
    return Response.json({ ok: true, event, customer: { name: customer.name, email: customer.email, phone: customer.phone } });
  });
}
