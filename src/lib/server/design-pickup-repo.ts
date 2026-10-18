/**
 * Server only. The pickup slip's private link (domain/design/pickup-slip.ts):
 * one a job, for good, made the first time a member opens the job's event in
 * the Install Scheduler. The installer opens it with no sign-in, at the
 * wholesaler's counter: the 48 random characters are the key. Under the
 * designer's tenant rule, the link is made for a business id that only ever
 * comes from the signed-in member; opening it reads only that job's order.
 */
import { randomBytes } from "node:crypto";
import { pickupSlip, type PickupSlip } from "@/lib/domain/design/pickup-slip";
import type { ISODate } from "@/lib/domain/types";
import { jobOrder } from "./design-after-sale-repo";
import { jobById } from "./design-crm-repo";
import { query } from "./db";

const TOKEN = /^[a-f0-9]{48}$/;

/** The job's pickup slip link token, made once. */
export async function pickupToken(businessId: string, jobId: string): Promise<string> {
  await query(
    `insert into design_pickup_links (token, business_id, job_id) values ($1, $2, $3)
     on conflict (business_id, job_id) do nothing`,
    [randomBytes(24).toString("hex"), businessId, jobId],
  );
  const rows = await query<{ token: string }>(`select token from design_pickup_links where business_id = $1 and job_id = $2`, [
    businessId,
    jobId,
  ]);
  return rows[0].token;
}

/** The slip a link opens, or null for a link never made (or a job with no order: nothing to collect). */
export async function slipByToken(token: string): Promise<PickupSlip | null> {
  if (!TOKEN.test(token)) return null;
  const links = await query<{ businessId: string; jobId: string; business: string }>(
    `select l.business_id as "businessId", l.job_id as "jobId", b.name as business
       from design_pickup_links l join businesses b on b.id = l.business_id where l.token = $1`,
    [token],
  );
  const link = links[0];
  if (!link) return null;
  const [order, found] = await Promise.all([jobOrder(link.businessId, link.jobId), jobById(link.businessId, link.jobId)]);
  if (typeof order === "string" || !found) return null;
  return pickupSlip({
    business: link.business,
    reference: order.order.reference,
    installDate: (found.job.installDate as ISODate | null) ?? null,
    address: found.job.address || order.address,
    installer: found.job.details?.installer ?? null,
    orderedAt: order.order.orderedAt,
    groups: order.groups.map((g) => ({
      supplier: g.list ? g.supplier : null,
      so: (g.list && order.order.salesOrders?.[g.list]) || "",
      items: g.items.map((i) => ({ qty: i.qty, item: i.item, sku: i.sku })),
    })),
  });
}
