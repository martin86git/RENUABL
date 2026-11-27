/**
 * Server only, for RENUABL's staff alone (domain/design/hq.ts): the people who asked about RENUABL Business. Like
 * design-admin-repo.ts it reads across businesses, so it is never called from a business's own routes.
 */
import type { HqLead } from "@/lib/domain/design/hq";
import { query } from "./db";

/** The latest enquiries: details given in the demo, Talk to sales, and the Marketplace waiting list. */
export async function hqLeads(): Promise<HqLead[]> {
  const rows = await query<{
    id: string;
    kind: string;
    email: string;
    name: string | null;
    business: string | null;
    mobile: string | null;
    users: number | null;
    note: string | null;
    at: Date | string;
  }>(`select id, kind, email, name, business, mobile, users, note, at from design_leads order by at desc limit 300`);
  return rows.map((r) => ({ ...r, at: new Date(r.at).toISOString() }));
}
