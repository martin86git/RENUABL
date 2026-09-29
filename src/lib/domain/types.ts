import type { PlacedPanel } from "./panel-plan";
/**
 * Core domain types shared by the consumer experience and the installer portal.
 * These are framework-agnostic and must not import React or Next.js.
 */
import type { InstallRates, PartnerType } from "./partner";
import type { ComplianceRecord } from "./compliance";

export type ISODate = string; // YYYY-MM-DD
export type ISODateTime = string;

export interface Address {
  line: string;
  suburb: string;
  state: string;
  postcode: string;
  /** From Google Places when available: used for roof and sunshine data. */
  lat?: number;
  lng?: number;
  placeId?: string;
}

// ---------------------------------------------------------------------------
// Home analysis + energy profile (consumer answers)
// ---------------------------------------------------------------------------

export type Storeys = "single" | "double";

/** What RENUABL works out about the home from its address (roof, orientation). */
export interface HomeAnalysis {
  storeys: Storeys;
  roof: string;
  orientation: string;
  maxPanels: number;
  /** NASA POWER sunshine for the home's coordinates, when known. */
  sunshine?: Sunshine | null;
  /** Google Solar API: yearly sunshine hours on the usable parts of this roof, when known. */
  roofSunHours?: number | null;
}

/** The few yes/no questions the customer answers. */
export interface EnergyProfile {
  /** Already charges an EV at home (its usage is on the bill). */
  ev: boolean;
  /** Planning an EV (or another one): usage the bill doesn't show yet. */
  evPlanned: boolean;
  /** Wants a battery: solar gets headroom to charge it, and a battery option is suggested. */
  wantsBattery: boolean;
  backup: boolean;
  /** What the roof is made of: sets the mounting kit. "unsure" is quoted as tile and checked on the call. */
  roofType?: RoofType;
  /** Only asked for flat roofs; unanswered means laid flat. Tilting is confirmed on the call (roof space, looks). */
  flatMount?: FlatMount;
  storeys?: "single" | "double";
  /** "unsure" is quoted as single phase and checked on the call. */
  phase?: "single" | "three" | "unsure";
  /** Only asked when the bill shows existing solar. */
  existingSize?: ExistingSolarSize;
  /** Only asked when the customer doesn't know their existing system's size. */
  existingPlan?: ExistingSolarPlan;
}

export type RoofType = "tin" | "tile" | "flat" | "unsure";
/** Flat roofs only: panels laid flat (the default) or on tilt frames (a tilt kit and a per-panel premium). */
export type FlatMount = "flat" | "tilt";
export type ExistingSolarSize = "under-5" | "5-10" | "over-10" | "unsure";
export type ExistingSolarPlan = "replace" | "expand";

/** The usage and prices a system is sized and costed against, from the customer's bill. */
export interface UsageBasis {
  annualKwh: number;
  dailyKwh: number;
  /** Share of daily use outside daylight hours (what a battery can cover). */
  eveningShare: number;
  usageRate: number;
  feedInRate: number;
  /** Set when the home already has solar and the customer is expanding it. */
  existingSolar: { exportedDailyKwh: number } | null;
  /** Expected daily output per kW of panels at this home, averaged over the year. */
  dailyYieldKwhPerKw: number;
  /** The same in winter (June to August), when sunshine is weakest: battery systems are sized to it. */
  winterYieldKwhPerKw: number;
}

import type { BomLine } from "./costing";
import type { RebateLine } from "./rebates";
import type { Sunshine } from "./sunshine";

// ---------------------------------------------------------------------------
// System recommendation
// ---------------------------------------------------------------------------

export type SystemTier = "recommended" | "independence" | "essential";

export interface SystemConfig {
  panelCount: number;
  batteryKwh: number; // 0 = no battery
  evCharger: boolean;
  /** Adds to a system the home already has (panelCount is then the extra panels, often 0). */
  existingSolar?: boolean;
  /** No battery yet, but a battery-ready (hybrid) inverter so one can be added later. */
  batteryReady?: boolean;
}

export interface SystemEstimate {
  solarKw: number;
  annualGenerationKwh: number;
  annualSavings: number;
  paybackYears: number;
  selfPoweredShare: number; // 0..1
}

export type LineItemId = "solar" | "battery" | "ev-charger" | "monitoring" | "double-storey" | AddOnId;

export interface LineItem {
  id: LineItemId;
  label: string;
  amount: number;
  /** Whether the customer can take it out at checkout. */
  removable: boolean;
}

export interface PriceBreakdown {
  lines: LineItem[];
  /** Supplier-cost bill of materials behind the lines (for installers and audits, not customers). */
  bom: BomLine[];
  gross: number;
  /** Total of the rebate lines. */
  rebates: number;
  /** Each rebate, shown separately. */
  rebateLines: RebateLine[];
  /** Solar Victoria interest-free loan, if taken: lowers the upfront cost, repaid later. */
  loan: number;
  /** What the customer pays upfront: total less any loan. */
  outOfPocket: number;
  total: number;
  deposit: number;
  /** Add-ons the customer wants to talk about on the call (no price yet, not in the total). */
  discuss: { id: AddOnId; label: string }[];
  /** Coming-soon products the customer wants to hear about (not priced, not on the call). */
  interested: { id: AddOnId; label: string }[];
}

export interface TierRecommendation {
  tier: SystemTier;
  config: SystemConfig;
  why: string[];
}

export interface Recommendation {
  tiers: Record<SystemTier, TierRecommendation>;
  usage: UsageBasis;
}

export type AddOnId = "heat-pump" | "reverse-cycle" | "smart-switchboard" | "home-backup" | "smart-home";

export interface AddOn {
  id: AddOnId;
  name: string;
  blurb: string;
  /** Customer price, or null while it isn't costed: it's discussed and quoted on the call instead. */
  price: number | null;
  /** Not sold yet: the customer can ask to hear when it's available (no price, not discussed on the call). */
  comingSoon?: boolean;
}

// ---------------------------------------------------------------------------
// Installers
// ---------------------------------------------------------------------------

export interface Installer {
  id: string;
  name: string;
  suburbBase: string;
  servicePostcodes: [number, number][]; // inclusive ranges
  rating: number; // 0..5
  reviewCount: number;
  installsCompleted: number;
  yearsOperating: number;
  onTimeRate: number; // 0..1
  firstTimePassRate: number; // 0..1
  accreditations: string[];
  weeklyCapacity: number;
  /** RENUABL's installer of choice: always matched first where it operates. */
  preferred?: boolean;
  /**
   * Only show ratings, review counts and install numbers to customers when
   * they are verified figures supplied by the installer. Never invent them
   * for a real business.
   */
  verifiedStats?: boolean;
  /** Where `rating`/`reviewCount` come from when they are public third-party figures. */
  reviewSource?: "Google";
  /** Made up for the demo: never shown to customers on the live site. */
  fictional?: boolean;
  /** Where the partner works from, for their close-to-home rate. */
  baseLocation?: { lat: number; lng: number };
  /** Installation only (RENUABL sells and supplies) or a retailer. Installation only when unset. */
  partnerType?: PartnerType;
  /** ABN, for payout invoices. */
  abn?: string;
  /** For SMS alerts, +614XXXXXXXX. */
  mobile?: string;
  /** Licences and insurance, with expiry dates. */
  compliance?: ComplianceRecord[];
  /** The partner's own rates from sign-up. Without them, RENUABL's rates are used. */
  pricing?: {
    rates: InstallRates;
    supplyCosts?: Record<string, number>;
    margin?: number;
  };
}

export interface InstallerMatch {
  installer: Installer;
  score: number;
  reasons: string[];
}

// ---------------------------------------------------------------------------
// Scheduling
// ---------------------------------------------------------------------------

export interface TimeWindow {
  id: string;
  label: string;
  detail: string;
}

export interface DayAvailability {
  date: ISODate;
  windows: string[]; // TimeWindow ids that are open
}

// ---------------------------------------------------------------------------
// Installer portal
// ---------------------------------------------------------------------------

export type JobStage = "new" | "accepted" | "scheduled" | "in-progress" | "completed";

export type FieldStatus = "en-route" | "on-site" | "installing" | "final-checks" | "complete";

export interface StatusEvent {
  status: FieldStatus;
  at: ISODateTime;
}

export interface ChecklistItem {
  id: string;
  label: string;
  done: boolean;
}

export interface JobDocument {
  id: string;
  name: string;
  kind: "approval" | "design" | "compliance" | "contract" | "photo";
  status: "ready" | "required" | "submitted";
}

export interface JobMessage {
  id: string;
  from: "customer" | "renuabl" | "installer";
  author: string;
  body: string;
  at: ISODateTime;
}

export interface JobActivity {
  id: string;
  label: string;
  at: ISODateTime;
}

export interface Job {
  id: string;
  reference: string;
  /** Private key of the job's installation record (photos and serials); in the customer's record link. */
  recordKey: string;
  customer: { name: string; phone: string; email: string };
  address: Address;
  packageName: string;
  system: SystemConfig;
  /** The customer is claiming the Solar Victoria rebate. */
  solarVictoria?: boolean;
  stage: JobStage;
  preferredDate: ISODate;
  windowId: string;
  crewId: string | null;
  value: number;
  site: {
    storeys: Storeys;
    roof: string;
    /** "Not sure" is fitted as single phase. */
    phase?: "single" | "three";
    /** Flat roof only: panels on tilt frames. */
    tilt?: boolean;
    orientation: string;
    accessNotes: string;
    switchboardNotes: string;
    imagery: { id: string; label: string }[];
  };
  checklist: ChecklistItem[];
  documents: JobDocument[];
  messages: JobMessage[];
  activity: JobActivity[];
  statusHistory: StatusEvent[];
  /** The partner's saved panel layout (from the Design section). */
  layout?: {
    /** Panels placed by hand (the Design tab). */
    panels?: PlacedPanel[];
    /** Older layouts: spots from Google's roof model. */
    slots?: number[];
    arrays: number;
    updatedAt: string;
  };
  /** An open offer to this partner: accept or decline before it expires. */
  offer?: { id: string; expiresAt: string };
}

export interface Crew {
  id: string;
  name: string;
  lead: string;
}
