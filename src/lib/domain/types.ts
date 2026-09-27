/**
 * Core domain types shared by the consumer experience and the installer portal.
 * These are framework-agnostic and must not import React or Next.js.
 */

export type ISODate = string; // YYYY-MM-DD
export type ISODateTime = string;

export interface Address {
  line: string;
  suburb: string;
  state: string;
  postcode: string;
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
}

/** The few yes/no questions the customer answers. */
export interface EnergyProfile {
  /** Already charges an EV at home (its usage is on the bill). */
  ev: boolean;
  /** Planning an EV (or another one): usage the bill doesn't show yet. */
  evPlanned: boolean;
  /** Might add a battery later: solar needs headroom to charge it. */
  batteryPlanned: boolean;
  backup: boolean;
}

/** The usage and prices a system is sized and costed against, from the customer's bill. */
export interface UsageBasis {
  annualKwh: number;
  dailyKwh: number;
  /** Share of daily use outside daylight hours (what a battery can cover). */
  eveningShare: number;
  usageRate: number;
  feedInRate: number;
}

// ---------------------------------------------------------------------------
// System recommendation
// ---------------------------------------------------------------------------

export type SystemTier = "recommended" | "independence" | "essential";

export interface SystemConfig {
  panelCount: number;
  batteryKwh: number; // 0 = no battery
  evCharger: boolean;
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
  gross: number;
  rebates: number;
  total: number;
  deposit: number;
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

export type AddOnId = "heat-pump" | "smart-switchboard" | "home-backup" | "smart-home";

export interface AddOn {
  id: AddOnId;
  name: string;
  blurb: string;
  price: number;
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
  customer: { name: string; phone: string; email: string };
  address: Address;
  packageName: string;
  system: SystemConfig;
  stage: JobStage;
  preferredDate: ISODate;
  windowId: string;
  crewId: string | null;
  value: number;
  site: {
    storeys: Storeys;
    roof: string;
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
}

export interface Crew {
  id: string;
  name: string;
  lead: string;
}
