/** Server only. Partner accounts in the database, made from sign-up applications. */
import type { ComplianceRecord } from "@/lib/domain/compliance";
import type { OfferPartner } from "@/lib/domain/offers";
import type { PartnerApplication } from "@/lib/domain/partner";
import type { Installer } from "@/lib/domain/types";
import { newId, query } from "./db";

export type PartnerStatus = OfferPartner["status"];

export interface PartnerRow {
  id: string;
  reference: string;
  status: PartnerStatus;
  type: "installer" | "retailer";
  email: string;
  full_name: string;
  mobile: string | null;
  business_name: string;
  abn: string | null;
  base: { line?: string; suburb?: string; state?: string; postcode?: string; lat?: number; lng?: number } | null;
  radius_km: number;
  insurance_expires: string | null;
  public_liability: string | null;
  application: PartnerApplication;
  priority: number;
  created_at: string;
  decided_at: string | null;
}

const COLUMNS = `id, reference, status, type, email, full_name, mobile, business_name, abn, base, radius_km,
  to_char(insurance_expires, 'YYYY-MM-DD') as insurance_expires, public_liability, application, priority, created_at, decided_at`;

/** Saves an application as a pending partner. A re-application from the same email replaces a pending or declined one. */
export async function savePartnerApplication(app: PartnerApplication, reference: string): Promise<PartnerRow> {
  const email = app.email.trim().toLowerCase();
  const rows = await query<PartnerRow>(
    `insert into partners (id, reference, type, email, full_name, mobile, business_name, abn, base, radius_km, insurance_expires, public_liability, application)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
     on conflict (email) do update set
       reference = excluded.reference, type = excluded.type, full_name = excluded.full_name, mobile = excluded.mobile,
       business_name = excluded.business_name, abn = excluded.abn, base = excluded.base, radius_km = excluded.radius_km,
       insurance_expires = excluded.insurance_expires, public_liability = excluded.public_liability,
       application = excluded.application,
       status = case when partners.status = 'approved' then partners.status else 'pending' end
     returning ${COLUMNS}`,
    [
      newId("pa"),
      reference,
      app.type,
      email,
      app.fullName,
      app.mobile,
      app.businessName,
      app.abn,
      JSON.stringify(app.base),
      app.radiusKm,
      app.insurance.expires,
      app.insurance.publicLiability,
      JSON.stringify(app),
    ],
  );
  return rows[0];
}

export async function listPartners(): Promise<PartnerRow[]> {
  return query<PartnerRow>(`select ${COLUMNS} from partners order by (status = 'pending') desc, created_at desc limit 500`);
}

export async function getPartner(id: string): Promise<PartnerRow | null> {
  return (await query<PartnerRow>(`select ${COLUMNS} from partners where id = $1`, [id]))[0] ?? null;
}

export async function partnerByEmail(email: string): Promise<PartnerRow | null> {
  return (await query<PartnerRow>(`select ${COLUMNS} from partners where email = $1`, [email.toLowerCase()]))[0] ?? null;
}

export async function setPartnerStatus(id: string, status: PartnerStatus, priority?: number): Promise<PartnerRow | null> {
  const rows = await query<PartnerRow>(
    `update partners set status = $2, priority = coalesce($3, priority), decided_at = now() where id = $1 returning ${COLUMNS}`,
    [id, status, priority ?? null],
  );
  return rows[0] ?? null;
}

/** For matching new jobs. */
export async function offerablePartners(): Promise<OfferPartner[]> {
  const rows = await query<PartnerRow>(`select ${COLUMNS} from partners where status = 'approved'`);
  return rows.map(toOfferPartner);
}

export function toOfferPartner(r: PartnerRow): OfferPartner {
  return {
    id: r.id,
    status: r.status,
    base: r.base,
    radiusKm: r.radius_km,
    priority: r.priority,
    insuranceExpires: r.insurance_expires,
    publicLiability: r.public_liability === null ? null : Number(r.public_liability),
  };
}

/** A partner as the portal's Installer shape (rates, compliance, contact). */
export function partnerAsInstaller(r: PartnerRow): Installer {
  const app = r.application;
  // From sign-up: insurance with its expiry; licence and accreditation numbers (no expiry dates yet).
  const compliance: ComplianceRecord[] = [
    ...(r.insurance_expires
      ? [
          {
            kind: "public-liability" as const,
            amount: r.public_liability ? Number(r.public_liability) : undefined,
            expires: r.insurance_expires,
          },
        ]
      : []),
    ...(app?.electricalLicence ? [{ kind: "electrical-licence" as const, number: app.electricalLicence }] : []),
    ...(app?.accreditationNumber ? [{ kind: "accreditation" as const, number: app.accreditationNumber }] : []),
  ];
  return {
    id: r.id,
    name: r.business_name,
    suburbBase: r.base?.suburb ?? "",
    servicePostcodes: [],
    rating: 0,
    reviewCount: 0,
    installsCompleted: 0,
    yearsOperating: 0,
    onTimeRate: 0,
    firstTimePassRate: 0,
    accreditations: [],
    weeklyCapacity: 0,
    verifiedStats: false,
    partnerType: r.type,
    abn: r.abn ?? undefined,
    mobile: r.mobile ?? undefined,
    compliance,
    baseLocation: typeof r.base?.lat === "number" && typeof r.base?.lng === "number" ? { lat: r.base.lat, lng: r.base.lng } : undefined,
    pricing: app?.rates ? { rates: app.rates, supplyCosts: app.supply?.costs, margin: app.supply?.margin } : undefined,
  };
}
