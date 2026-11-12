/**
 * Server only. RENUABL's own homeowner leads in RENUABL's own CRM: RENUABL is a business on RENUABL Business, the
 * account whose owner is RENUABL_CRM_EMAIL (e.g. martin@renuabl.com.au, set up like any business at /design). A lead
 * from the homeowner site becomes a customer and a deal at "lead" there, with a note of everything the lead page
 * knew, so it gets the same proposals, chat and calls as any deal. Nothing here touches HubSpot.
 */
import { cleanCustomerInput } from "@/lib/domain/design/crm";
import { normaliseMobile } from "@/lib/domain/contact";
import { plainText } from "@/lib/domain/emails";
import { dbConfigured, query, transaction } from "./db";
import { createCustomer, createJob, record } from "./design-crm-repo";

/** Who writes RENUABL's own leads on the record. */
const BY = "website";

export interface OwnCrm {
  businessId: string;
  name: string;
}

let cached: { email: string; crm: OwnCrm | null; at: number } | null = null;

/** RENUABL's own business in its CRM, or null when RENUABL_CRM_EMAIL isn't set or has no business yet. */
export async function renuablCrm(): Promise<OwnCrm | null> {
  const email = process.env.RENUABL_CRM_EMAIL?.trim().toLowerCase();
  if (!email || !dbConfigured()) return null;
  if (cached && cached.email === email && Date.now() - cached.at < 60_000) return cached.crm;
  const rows = await query<OwnCrm>(
    `select b.id as "businessId", b.name from business_members m join businesses b on b.id = m.business_id
      where lower(m.email) = $1 and m.role = 'owner' limit 1`,
    [email],
  );
  cached = { email, crm: rows[0] ?? null, at: Date.now() };
  return cached.crm;
}

export interface HomeLead {
  firstName?: string | null;
  mobile?: string | null;
  email?: string | null;
  /** The home's address, when the lead page has it. */
  home?: string | null;
  /** e.g. "Solar and a battery". */
  lookingFor?: string | null;
  /** Where it came from, e.g. "Quick quote (/quote)". */
  source: string;
  /** Every line the lead page knew (answers, ad source, consent record), kept as one note on the deal. */
  details: Record<string, string | undefined>;
}

/** The deal a homeowner lead became. */
export interface HomeDeal {
  businessId: string;
  customerId: string;
  jobId: string;
}

const digits = (s: string) => s.replace(/\D/g, "");

/** A business's customer with this mobile on their record (written +61… or 04…), or null. */
export async function findCustomerByMobile(businessId: string, mobile: string): Promise<string | null> {
  const m = normaliseMobile(mobile);
  if (!m) return null;
  const local = `0${digits(m).slice(2)}`;
  const found = await query<{ id: string }>(
    `select id from design_customers where business_id = $1 and regexp_replace(phone, '\\D', '', 'g') in ($2, $3)
      order by created_at desc limit 1`,
    [businessId, digits(m), local],
  );
  return found[0]?.id ?? null;
}

/**
 * A homeowner lead into RENUABL's CRM: the customer found by email, else by mobile (never overwritten), else made;
 * then a new deal at "lead" with the note. Null when RENUABL's CRM isn't set up or the lead couldn't be kept (logged:
 * the lead page carries on).
 */
export async function addHomeLead(lead: HomeLead): Promise<HomeDeal | null> {
  const crm = await renuablCrm().catch(() => null);
  if (!crm) return null;
  const mobile = lead.mobile ? normaliseMobile(lead.mobile) : null;
  const email = lead.email?.trim().toLowerCase() || null;
  if (!mobile && !email) return null;
  try {
    let customerId: string | null = null;
    if (email) {
      const found = await query<{ id: string }>(`select id from design_customers where business_id = $1 and lower(email) = $2 limit 1`, [
        crm.businessId,
        email,
      ]);
      customerId = found[0]?.id ?? null;
    }
    if (!customerId && mobile) {
      const local = `0${digits(mobile).slice(2)}`;
      const found = await query<{ id: string }>(
        `select id from design_customers where business_id = $1 and regexp_replace(phone, '\\D', '', 'g') in ($2, $3) limit 1`,
        [crm.businessId, digits(mobile), local],
      );
      customerId = found[0]?.id ?? null;
    }
    const title = plainText(lead.lookingFor, 60) || "Solar";
    const job = {
      title,
      address: plainText(lead.home, 200),
      lat: null,
      lng: null,
      stage: "lead" as const,
      value: null,
      installDate: null,
      details: {},
    };
    let jobId: string;
    if (customerId) {
      const made = await createJob(crm.businessId, customerId, job, BY);
      if (typeof made === "string") return null;
      jobId = made.id;
    } else {
      const first = plainText(lead.firstName, 40);
      const input = cleanCustomerInput({
        firstName: first || "New lead",
        lastName: first ? "" : `(${mobile ?? email})`,
        phone: mobile ?? "",
        email: email ?? "",
        address: plainText(lead.home, 200),
        source: plainText(lead.source, 40),
      });
      if (!input.ok) return null;
      const made = await createCustomer(crm.businessId, input.value, job, BY);
      if (made === "full" || !made.job) return null;
      customerId = made.customer.id;
      jobId = made.job.id;
    }
    const lines = Object.entries(lead.details)
      .filter((e): e is [string, string] => typeof e[1] === "string" && e[1].trim() !== "")
      .slice(0, 30)
      .map(([k, v]) => `${plainText(k, 60)}: ${plainText(v, 400)}`);
    const cid = customerId;
    await transaction((q) =>
      record(q, crm.businessId, {
        customerId: cid,
        jobId,
        kind: "note",
        text: [`New lead from ${plainText(lead.source, 60)}.`, ...lines].join("\n"),
        by: BY,
      }),
    );
    return { businessId: crm.businessId, customerId: cid, jobId };
  } catch (e) {
    console.error("home lead not kept in RENUABL's CRM", e instanceof Error ? e.message : e);
    return null;
  }
}
