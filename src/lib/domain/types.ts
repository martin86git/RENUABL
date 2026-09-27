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
// Energy profile (consumer answers)
// ---------------------------------------------------------------------------

export type HouseholdSize = "1-2" | "3-4" | "5+";
export type BillBand = "under-400" | "400-700" | "700-1000" | "over-1000";
export type DaytimePresence = "mostly-home" | "sometimes" | "mostly-away";
export type EvStatus = "have" | "planning" | "none";
export type Storeys = "single" | "double";
export type BackupPreference = "important" | "nice-to-have" | "not-needed";

export interface EnergyProfile {
  household: HouseholdSize;
  bill: BillBand;
  daytime: DaytimePresence;
  ev: EvStatus;
  storeys: Storeys;
  backup: BackupPreference;
}

// ---------------------------------------------------------------------------
// System recommendation
// ---------------------------------------------------------------------------

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

export interface PriceBreakdown {
  lines: { label: string; amount: number }[];
  gross: number;
  rebates: number;
  total: number;
  deposit: number;
}

export interface Recommendation {
  recommended: SystemConfig;
  reasons: string[];
  estimatedAnnualUsageKwh: number;
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
