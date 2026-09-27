/**
 * Server only. Who the portal is acting for, and how to reach a job's
 * customer. Until partner logins and database-backed jobs arrive, the portal
 * acts for the demo partner (preview only), and demo jobs have no real
 * customer, so nothing is ever texted to them.
 */
import type { PartnerType } from "@/lib/domain/partner";
import { getCurrentInstaller } from "@/lib/services/installer";

export function currentPartner(): { id: string; name: string; type: PartnerType; margin?: number; mobile?: string } {
  const i = getCurrentInstaller();
  return { id: i.id, name: i.name, type: i.partnerType ?? "installer", margin: i.pricing?.margin, mobile: i.mobile };
}

/** The customer's mobile for a job's record, for texts. Null for demo jobs. */
export async function customerMobileFor(recordKey: string): Promise<{ name: string; mobile: string } | null> {
  void recordKey;
  return null;
}
