/** Server only. Whether a business is a demo account (domain/design/demo.ts). On its own so anything may ask. */
import { DEMO_DOMAIN } from "@/lib/domain/design/demo";
import { query } from "./db";

/** A demo business is one made by an email on the demo's reserved domain. */
export async function isDemoBusiness(businessId: string): Promise<boolean> {
  const rows = await query<{ demo: boolean }>(`select created_by like $2 as demo from businesses where id = $1`, [
    businessId,
    `%@${DEMO_DOMAIN}`,
  ]);
  return rows[0]?.demo === true;
}
