/**
 * Server only. Who a portal request is acting for, what they may change, and
 * how to reach a job's customer. A signed-in partner may write only to their
 * own jobs' records; the sample portal (preview only) may write to its demo
 * records. Demo jobs have no real customer, so they're never texted.
 */
import type { PartnerType } from "@/lib/domain/partner";
import { MOCK_INSTALLER } from "@/lib/mock/installers";
import { dbConfigured, query } from "./db";
import { partnerOwnsRecord } from "./jobs-repo";
import { partnerAsInstaller } from "./partners-repo";
import { portalContext } from "./portal";

export interface ActingPartner {
  id: string;
  name: string;
  type: PartnerType;
  margin?: number;
  mobile?: string;
}

export async function currentPartner(): Promise<ActingPartner | null> {
  const ctx = await portalContext();
  if (!ctx) return null;
  const i = ctx.kind === "partner" ? partnerAsInstaller(ctx.partner) : MOCK_INSTALLER();
  return { id: i.id, name: i.name, type: i.partnerType ?? "installer", margin: i.pricing?.margin, mobile: i.mobile };
}

/** Whether this request may change the job record with this key. */
export async function mayWriteRecord(recordKey: string): Promise<boolean> {
  const ctx = await portalContext();
  if (!ctx) return false;
  if (ctx.kind === "demo") return true;
  return partnerOwnsRecord(ctx.partner.id, recordKey);
}

/** The customer's name and mobile for a job's record, for texts. Null for demo jobs. */
export async function customerMobileFor(recordKey: string): Promise<{ name: string; mobile: string } | null> {
  if (!dbConfigured()) return null;
  const rows = await query<{ customer: { name: string; phone: string } }>(`select customer from jobs where record_key = $1`, [recordKey]);
  const c = rows[0]?.customer;
  return c?.phone ? { name: c.name, mobile: c.phone } : null;
}

/** The mobile of the partner who owns a job record, for texts about it. */
export async function partnerMobileFor(recordKey: string): Promise<string | null> {
  if (!dbConfigured()) return null;
  const rows = await query<{ mobile: string | null }>(
    `select p.mobile from jobs j join partners p on p.id = j.partner_id where j.record_key = $1`,
    [recordKey],
  );
  return rows[0]?.mobile ?? null;
}
