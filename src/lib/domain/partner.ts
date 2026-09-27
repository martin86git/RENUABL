/**
 * RENUABL partners: the businesses that install (and, for retailers, sell and
 * supply) customers' systems. Sign-up rules, credential checks and the
 * suggested rates shown in grey on the sign-up form. Pure and tested.
 *
 * RENUABL sends partners the work (no lead fees) and collects the customer's
 * payment, so a partner is paid as long as they deliver the job.
 */
import { BATTERY, EV_CHARGER, HYBRID_INVERTERS, HYBRID_INVERTERS_3PH, PANEL, STRING_INVERTERS, STRING_INVERTERS_3PH } from "./catalogue";
import { normaliseMobile } from "./contact";
import { COSTING } from "./costing";
import type { PartnerPricing } from "./costing";
import type { Address, ISODate, Installer } from "./types";

export type PartnerType = "installer" | "retailer";

export const PARTNER_TYPES: { value: PartnerType; label: string; title: string; detail: string }[] = [
  {
    value: "installer",
    label: "Installer",
    title: "Installation only",
    detail:
      "You perform the installation, arrange the Certificate of Electrical Safety and help complete the grid connection. RENUABL makes the sale and supplies the equipment.",
  },
  {
    value: "retailer",
    label: "Retailer",
    title: "Supply, installation and grid connection",
    detail:
      "You are the retailer conducting the sale, not RENUABL. You supply the panels, inverter and battery, install them, arrange the electrical inspection and process the grid connection.",
  },
];

/** Why partners join: shown on the sign-up introduction. */
export const PARTNER_BENEFITS = [
  {
    title: "Work sent to you",
    detail: "Customers come to RENUABL, choose a system sized from their bill and book an install date with you.",
  },
  { title: "No lead fees", detail: "You don't pay for leads or enquiries. You're matched with jobs in the area you choose." },
  {
    title: "Paid for the work you do",
    detail: "RENUABL collects the customer's payment, so you're paid as long as you deliver the job as agreed.",
  },
  {
    title: "Jobs arrive ready to go",
    detail: "The system, roof, switchboard and access are confirmed with the customer before the job reaches you.",
  },
];

// ---------------------------------------------------------------------------
// Rates

/** A partner's installation rates, ex GST. Solar is dollars per watt of panels (0.30 = 30c/W). */
export interface InstallRates {
  solarPerWatt: number;
  /** A lower rate for single-storey homes within `nearHomeKm` of the partner's base. */
  nearHomePerWatt: number;
  nearHomeKm: number;
  /** Each array beyond the two the base rate covers. */
  extraArray: number;
  doubleStorey: number;
  switchboardUpgrade: number;
  tiltPerPanel: number;
  batteryPerStack: number;
  /** Each battery module beyond a full stack. */
  batteryExtraModule: number;
  threePhase: number;
  evCharger: number;
}

export const RATE_FIELDS: { key: keyof InstallRates; label: string; unit: "c/W" | "$" | "km"; detail?: string }[] = [
  { key: "solarPerWatt", label: "Solar installation", unit: "c/W", detail: "Per watt of panels. Covers up to two arrays." },
  {
    key: "nearHomePerWatt",
    label: "Close to home",
    unit: "c/W",
    detail: "Single-storey homes near your base: a sharper rate wins more of the jobs on your doorstep.",
  },
  { key: "nearHomeKm", label: "“Close to home” means within", unit: "km" },
  { key: "extraArray", label: "Each extra array", unit: "$", detail: "Beyond the two your solar rate covers." },
  { key: "doubleStorey", label: "Double-storey home", unit: "$" },
  { key: "switchboardUpgrade", label: "Switchboard upgrade", unit: "$" },
  { key: "tiltPerPanel", label: "Tilt frames", unit: "$", detail: "Per panel, on flat roofs." },
  { key: "batteryPerStack", label: "Battery installation", unit: "$", detail: "Per stack (up to six modules)." },
  { key: "batteryExtraModule", label: "Each module in a further stack", unit: "$" },
  { key: "threePhase", label: "Three-phase inverter", unit: "$" },
  { key: "evCharger", label: "EV charger installation", unit: "$" },
];

/**
 * The rates suggested in grey: RENUABL's current pricing, which keeps
 * customer prices competitive. Partners can set whatever they like.
 */
export function suggestedRates(): InstallRates {
  return {
    solarPerWatt: COSTING.solarInstallPerWatt,
    nearHomePerWatt: Math.round(COSTING.solarInstallPerWatt * 0.9 * 100) / 100,
    nearHomeKm: 10,
    extraArray: COSTING.thirdArrayInstall,
    doubleStorey: COSTING.doubleStoreyInstall,
    // PLACEHOLDER: RENUABL doesn't price switchboard upgrades yet.
    switchboardUpgrade: 1500,
    tiltPerPanel: COSTING.tiltInstallPerPanel,
    batteryPerStack: COSTING.batteryInstallPerStack,
    batteryExtraModule: COSTING.batteryInstallPerStack / BATTERY.modulesPerStack,
    threePhase: COSTING.threePhaseInstall,
    evCharger: COSTING.evChargerInstall,
  };
}

/** How a partner's rate compares with the suggestion, for a gentle nudge on the form. */
export function rateComparison(value: number, suggested: number): "below" | "in line" | "above" {
  if (!(suggested > 0)) return "in line";
  const ratio = value / suggested;
  return ratio > 1.1 ? "above" : ratio < 0.9 ? "below" : "in line";
}

// ---------------------------------------------------------------------------
// Retailers: supply costs for the products RENUABL offers, plus their margin

export interface SupplyItem {
  sku: string;
  name: string;
  group: "Panels" | "Solar inverters" | "Battery inverters" | "Battery" | "EV charger";
  /** RENUABL's current supplier cost, the grey suggestion. */
  suggested: number;
}

export const SUPPLY_ITEMS: SupplyItem[] = [
  { sku: PANEL.sku, name: PANEL.name, group: "Panels", suggested: PANEL.cost },
  ...[...STRING_INVERTERS, ...STRING_INVERTERS_3PH].map((i) => ({
    sku: i.sku,
    name: i.name,
    group: "Solar inverters" as const,
    suggested: i.cost,
  })),
  ...[...HYBRID_INVERTERS, ...HYBRID_INVERTERS_3PH].map((i) => ({
    sku: i.sku,
    name: i.name,
    group: "Battery inverters" as const,
    suggested: i.cost,
  })),
  { sku: BATTERY.module.sku, name: BATTERY.module.name, group: "Battery", suggested: BATTERY.module.cost },
  { sku: BATTERY.mount.sku, name: BATTERY.mount.name, group: "Battery", suggested: BATTERY.mount.cost },
  { sku: BATTERY.gateway.sku, name: BATTERY.gateway.name, group: "Battery", suggested: BATTERY.gateway.cost },
  { sku: BATTERY.gateway3ph.sku, name: BATTERY.gateway3ph.name, group: "Battery", suggested: BATTERY.gateway3ph.cost },
  { sku: EV_CHARGER.sku, name: EV_CHARGER.name, group: "EV charger", suggested: EV_CHARGER.cost },
];

/** Suggested margin for retailers (RENUABL's own margin today). */
export const SUGGESTED_MARGIN = COSTING.margin;

// ---------------------------------------------------------------------------
// The application

export interface PartnerApplication {
  type: PartnerType;
  fullName: string;
  email: string;
  /** +614XXXXXXXX */
  mobile: string;
  businessName: string;
  /** 11 digits, no spaces. */
  abn: string;
  website?: string;
  /** The business's postal or registered address, as written. */
  businessAddress: string;
  /** Where jobs are measured from (with coordinates when chosen from Google). */
  base: Address;
  radiusKm: number;
  /** Solar Accreditation Australia (formerly CEC) accreditation number. */
  accreditationNumber: string;
  electricalLicence: string;
  insurance: { publicLiability: number; expires: ISODate };
  rates: InstallRates;
  /** Retailers only: their cost per product (by SKU) and their margin. */
  supply?: { costs: Record<string, number>; margin: number };
}

export type PartnerField =
  | "type"
  | "fullName"
  | "email"
  | "mobile"
  | "businessName"
  | "abn"
  | "website"
  | "businessAddress"
  | "base"
  | "radiusKm"
  | "accreditationNumber"
  | "electricalLicence"
  | "publicLiability"
  | "expires"
  | "certificate"
  | "rates"
  | "supply"
  | "margin";

export type PartnerErrors = Partial<Record<PartnerField, string>>;

export const MIN_PUBLIC_LIABILITY = 10_000_000;
export const RADIUS_LIMITS = { min: 5, max: 200, suggested: 40 } as const;
export const CERTIFICATE_UPLOAD = { maxBytes: 4 * 1024 * 1024, types: ["application/pdf", "image/jpeg", "image/png"] } as const;

/** ABN checksum (ATO): subtract 1 from the first digit, weight, and the sum divides by 89. */
export function isValidAbn(raw: string): boolean {
  const digits = raw.replace(/\s/g, "");
  if (!/^\d{11}$/.test(digits)) return false;
  const weights = [10, 1, 3, 5, 7, 9, 11, 13, 15, 17, 19];
  const sum = [...digits].reduce((s, d, i) => s + (Number(d) - (i === 0 ? 1 : 0)) * weights[i], 0);
  return sum % 89 === 0;
}

/** "51 824 753 556" */
export function formatAbn(abn: string) {
  const d = abn.replace(/\D/g, "");
  return d.length === 11 ? `${d.slice(0, 2)} ${d.slice(2, 5)} ${d.slice(5, 8)} ${d.slice(8)}` : abn;
}

/** An accreditation number such as A1234567 (letters then digits). */
export function isAccreditationNumber(raw: string) {
  return /^[A-Z]{1,2}\d{5,8}$/i.test(raw.replace(/\s/g, ""));
}

/** http(s) and a domain; "example.com.au" becomes "https://example.com.au". */
export function normaliseWebsite(raw: string): string | null {
  const t = raw.trim();
  if (!t) return null;
  const withScheme = /^https?:\/\//i.test(t) ? t : `https://${t}`;
  try {
    const url = new URL(withScheme);
    return /^[\w-]+(\.[\w-]+)+$/.test(url.hostname) ? url.toString().replace(/\/$/, "") : null;
  } catch {
    return null;
  }
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const text = (v: unknown, max = 160) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const num = (v: unknown) => (typeof v === "number" ? v : typeof v === "string" && v.trim() !== "" ? Number(v) : NaN);

/** Sensible bounds for each rate, so a typo (3 for 0.30 c/W, or $15,000 for a tilt frame) is caught. */
const RATE_BOUNDS: Record<keyof InstallRates, [number, number]> = {
  solarPerWatt: [0.05, 1.5],
  nearHomePerWatt: [0.05, 1.5],
  nearHomeKm: [0, 50],
  extraArray: [0, 2000],
  doubleStorey: [0, 5000],
  switchboardUpgrade: [0, 10000],
  tiltPerPanel: [0, 200],
  batteryPerStack: [0, 10000],
  batteryExtraModule: [0, 3000],
  threePhase: [0, 3000],
  evCharger: [0, 5000],
};

export function validatePartnerApplication(
  raw: Record<string, unknown>,
  opts: { today: ISODate; hasCertificate: boolean },
): { application: PartnerApplication } | { errors: PartnerErrors } {
  const errors: PartnerErrors = {};
  const type: PartnerType | null = raw.type === "installer" || raw.type === "retailer" ? raw.type : null;
  if (!type) errors.type = "Choose installer or retailer.";

  const fullName = text(raw.fullName, 120);
  if (fullName.split(/\s+/).filter(Boolean).length < 2) errors.fullName = "Please enter your full name.";
  const email = text(raw.email).toLowerCase();
  if (!EMAIL.test(email)) errors.email = "Please enter a valid email address.";
  const mobile = normaliseMobile(text(raw.mobile));
  if (!mobile) errors.mobile = "Please enter an Australian mobile, e.g. 0412 345 678.";
  const businessName = text(raw.businessName, 160);
  if (!businessName) errors.businessName = "Please enter your business name.";
  const abn = text(raw.abn).replace(/\s/g, "");
  if (!isValidAbn(abn)) errors.abn = "That ABN doesn't look right. It's 11 digits, e.g. 51 824 753 556.";
  const websiteRaw = text(raw.website, 200);
  const website = websiteRaw ? normaliseWebsite(websiteRaw) : null;
  if (websiteRaw && !website) errors.website = "Please enter a web address like yourbusiness.com.au, or leave it blank.";
  const businessAddress = text(raw.businessAddress, 200);
  if (businessAddress.length < 8) errors.businessAddress = "Please enter your business address.";

  const base = raw.base as Address | undefined;
  const baseOk = base && typeof base.line === "string" && typeof base.suburb === "string" && typeof base.postcode === "string";
  if (!baseOk) errors.base = "Choose your base address from the list.";
  const radiusKm = num(raw.radiusKm);
  if (!(radiusKm >= RADIUS_LIMITS.min && radiusKm <= RADIUS_LIMITS.max))
    errors.radiusKm = `Choose a radius between ${RADIUS_LIMITS.min} and ${RADIUS_LIMITS.max} km.`;

  const accreditationNumber = text(raw.accreditationNumber, 20).replace(/\s/g, "").toUpperCase();
  if (!isAccreditationNumber(accreditationNumber)) errors.accreditationNumber = "Enter your accreditation number, e.g. A1234567.";
  const electricalLicence = text(raw.electricalLicence, 30).replace(/\s/g, "").toUpperCase();
  if (!/^[A-Z0-9-]{4,20}$/.test(electricalLicence)) errors.electricalLicence = "Enter your electrical licence number.";

  const insurance = (raw.insurance ?? {}) as Record<string, unknown>;
  const publicLiability = num(insurance.publicLiability);
  if (!(publicLiability >= MIN_PUBLIC_LIABILITY))
    errors.publicLiability = "RENUABL partners need at least $10 million public liability cover.";
  const expires = text(insurance.expires, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(expires) || expires <= opts.today)
    errors.expires = "Enter the date your cover runs until (in the future).";
  if (!opts.hasCertificate) errors.certificate = "Upload your certificate of currency (PDF or photo).";

  const rawRates = (raw.rates ?? {}) as Record<string, unknown>;
  const rates = {} as InstallRates;
  for (const key of Object.keys(RATE_BOUNDS) as (keyof InstallRates)[]) {
    const v = num(rawRates[key]);
    const [lo, hi] = RATE_BOUNDS[key];
    if (!(v >= lo && v <= hi)) {
      const field = RATE_FIELDS.find((f) => f.key === key)!;
      errors.rates = `Check “${field.label}”: it looks too ${v > hi ? "high" : "low"}.`;
    }
    rates[key] = v;
  }
  if (!errors.rates && rates.nearHomePerWatt > rates.solarPerWatt)
    errors.rates = "Your close-to-home rate should be no higher than your standard solar rate.";

  let supply: PartnerApplication["supply"];
  if (type === "retailer") {
    const rawSupply = (raw.supply ?? {}) as { costs?: Record<string, unknown>; margin?: unknown };
    const costs: Record<string, number> = {};
    for (const item of SUPPLY_ITEMS) {
      const v = num(rawSupply.costs?.[item.sku]);
      if (!(v > 0 && v < item.suggested * 5)) errors.supply = `Check your cost for ${item.name}.`;
      costs[item.sku] = v;
    }
    const margin = num(rawSupply.margin);
    if (!(margin >= 0 && margin <= 0.6)) errors.margin = "Enter a margin between 0% and 60%.";
    supply = { costs, margin };
  }

  if (Object.keys(errors).length) return { errors };
  return {
    application: {
      type: type!,
      fullName,
      email,
      mobile: mobile!,
      businessName,
      abn,
      website: website ?? undefined,
      businessAddress,
      base: {
        line: text(base!.line),
        suburb: text(base!.suburb, 60),
        state: text(base!.state, 10),
        postcode: text(base!.postcode, 4),
        lat: typeof base!.lat === "number" ? base!.lat : undefined,
        lng: typeof base!.lng === "number" ? base!.lng : undefined,
        placeId: typeof base!.placeId === "string" ? base!.placeId.slice(0, 300) : undefined,
      },
      radiusKm,
      accreditationNumber,
      electricalLicence,
      insurance: { publicLiability, expires },
      rates,
      supply,
    },
  };
}

// ---------------------------------------------------------------------------
// Distance

/** Straight-line distance between two points, in km. */
export function distanceKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(h));
}

/** The solar rate for a job: the close-to-home rate for single-storey homes near the base, else the standard rate. */
export function solarRateFor(rates: InstallRates, job: { distanceKm?: number; storeys: "single" | "double" }) {
  return job.storeys === "single" && job.distanceKm !== undefined && job.distanceKm <= rates.nearHomeKm
    ? rates.nearHomePerWatt
    : rates.solarPerWatt;
}

/** A matched partner's pricing for this home (distance for their close-to-home rate); none if they haven't set rates. */
export function partnerPricingFor(
  installer: { pricing?: Installer["pricing"]; baseLocation?: { lat: number; lng: number } } | undefined,
  home: Pick<Address, "lat" | "lng"> | null,
): PartnerPricing | undefined {
  if (!installer?.pricing) return undefined;
  const distance =
    installer.baseLocation && home?.lat !== undefined && home.lng !== undefined
      ? distanceKm(installer.baseLocation, { lat: home.lat, lng: home.lng })
      : undefined;
  return { ...installer.pricing, distanceKm: distance };
}

const dollars = (n: number) => `$${Math.round(n).toLocaleString("en-AU")}`;
const cents = (perWatt: number) => `${Math.round(perWatt * 1000) / 10}c/W`;

/** The application as "Label: value" lines, for RENUABL's CRM note and the partner's confirmation email. */
export function partnerSummary(app: PartnerApplication, extra: { reference: string; certificate?: string }): Record<string, string> {
  const r = app.rates;
  const out: Record<string, string> = {
    Reference: extra.reference,
    "Signing up as": PARTNER_TYPES.find((t) => t.value === app.type)!.title,
    Business: app.businessName,
    ABN: formatAbn(app.abn),
    Website: app.website ?? "None",
    "Business address": app.businessAddress,
    Base: `${app.base.line}, ${app.base.suburb} ${app.base.state} ${app.base.postcode}`,
    "Takes jobs within": `${app.radiusKm} km`,
    Contact: `${app.fullName}, ${app.mobile}, ${app.email}`,
    "Accreditation number": app.accreditationNumber,
    "Electrical licence": app.electricalLicence,
    "Public liability": `${dollars(app.insurance.publicLiability)}, current to ${app.insurance.expires}`,
    "Certificate of currency": extra.certificate ?? "Not stored: ask for a copy",
    "Solar installation": `${cents(r.solarPerWatt)}; ${cents(r.nearHomePerWatt)} for single-storey homes within ${r.nearHomeKm} km`,
    Variations: [
      `extra array ${dollars(r.extraArray)}`,
      `double storey ${dollars(r.doubleStorey)}`,
      `switchboard upgrade ${dollars(r.switchboardUpgrade)}`,
      `tilt frames ${dollars(r.tiltPerPanel)}/panel`,
      `three phase ${dollars(r.threePhase)}`,
      `EV charger ${dollars(r.evCharger)}`,
    ].join(", "),
    Battery: `${dollars(r.batteryPerStack)} per stack, ${dollars(r.batteryExtraModule)} per extra module`,
  };
  if (app.supply) {
    out["Margin"] = `${Math.round(app.supply.margin * 1000) / 10}%`;
    out["Supply costs"] = SUPPLY_ITEMS.map((i) => `${i.name} $${app.supply!.costs[i.sku].toFixed(2)}`).join("; ");
  }
  return out;
}

// ---------------------------------------------------------------------------
// The sign-up form's draft (what's typed), and turning it into an application

/** As typed: solar rates in cents per watt, margin in percent, blanks mean "use the suggestion". */
export interface PartnerDraft {
  type: PartnerType | null;
  fullName: string;
  email: string;
  mobile: string;
  businessName: string;
  abn: string;
  website: string;
  businessAddress: string;
  base: Address | null;
  radiusKm: number;
  accreditationNumber: string;
  electricalLicence: string;
  publicLiability: string;
  expires: string;
  rates: Partial<Record<keyof InstallRates, string>>;
  supply: Record<string, string>;
  margin: string;
}

export const EMPTY_PARTNER_DRAFT: PartnerDraft = {
  type: null,
  fullName: "",
  email: "",
  mobile: "",
  businessName: "",
  abn: "",
  website: "",
  businessAddress: "",
  base: null,
  radiusKm: RADIUS_LIMITS.suggested,
  accreditationNumber: "",
  electricalLicence: "",
  publicLiability: String(MIN_PUBLIC_LIABILITY),
  expires: "",
  rates: {},
  supply: {},
  margin: "",
};

/** A rate as shown on the form: solar rates in cents per watt, everything else as stored. */
export function rateForDisplay(key: keyof InstallRates, value: number) {
  return key === "solarPerWatt" || key === "nearHomePerWatt" ? Math.round(value * 1000) / 10 : value;
}

const typed = (v: string | undefined) => (v === undefined || v.trim() === "" ? null : Number(v.replace(/[$,\s%]/g, "")));

/** The rates a draft adds up to: typed values where given, the suggestion otherwise. */
export function draftRates(draft: Pick<PartnerDraft, "rates">): InstallRates {
  const suggested = suggestedRates();
  const out = { ...suggested };
  for (const key of Object.keys(suggested) as (keyof InstallRates)[]) {
    const v = typed(draft.rates[key]);
    if (v !== null) out[key] = key === "solarPerWatt" || key === "nearHomePerWatt" ? v / 100 : v;
  }
  return out;
}

/** The application the draft describes, ready for validatePartnerApplication (on either side). */
export function draftToApplication(draft: PartnerDraft): Record<string, unknown> {
  const app: Record<string, unknown> = {
    type: draft.type,
    fullName: draft.fullName,
    email: draft.email,
    mobile: draft.mobile,
    businessName: draft.businessName,
    abn: draft.abn,
    website: draft.website,
    businessAddress: draft.businessAddress,
    base: draft.base ?? undefined,
    radiusKm: draft.radiusKm,
    accreditationNumber: draft.accreditationNumber,
    electricalLicence: draft.electricalLicence,
    insurance: { publicLiability: typed(draft.publicLiability) ?? 0, expires: draft.expires },
    rates: draftRates(draft),
  };
  if (draft.type === "retailer") {
    const costs = Object.fromEntries(SUPPLY_ITEMS.map((i) => [i.sku, typed(draft.supply[i.sku]) ?? i.suggested]));
    const margin = typed(draft.margin);
    app.supply = { costs, margin: margin === null ? SUGGESTED_MARGIN : margin / 100 };
  }
  return app;
}

/** Which sign-up step each field is on, so errors send the partner to the right place. */
export const PARTNER_FIELD_STEP: Record<PartnerField, "type" | "business" | "area" | "credentials" | "rates" | "supply"> = {
  type: "type",
  fullName: "business",
  email: "business",
  mobile: "business",
  businessName: "business",
  abn: "business",
  website: "business",
  businessAddress: "business",
  base: "area",
  radiusKm: "area",
  accreditationNumber: "credentials",
  electricalLicence: "credentials",
  publicLiability: "credentials",
  expires: "credentials",
  certificate: "credentials",
  rates: "rates",
  supply: "supply",
  margin: "supply",
};
