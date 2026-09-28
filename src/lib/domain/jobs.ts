/**
 * Jobs made from customers' reservations. The reserve step sends the home,
 * system and site; this checks it (it comes from the browser) and turns
 * stored jobs into the portal's Job shape. Pure and tested.
 */
import { plainText } from "./emails";
import type { Address, ChecklistItem, ISODate, Job, JobDocument, JobStage, RoofType, SystemConfig } from "./types";

export type JobStatus = "unassigned" | "offered" | "accepted" | "scheduled" | "in-progress" | "completed" | "cancelled";

export interface JobRequest {
  address: Address;
  system: SystemConfig;
  site: { storeys: "single" | "double"; roof: RoofType; phase: "single" | "three"; tilt?: boolean };
  packageName: string;
  /** The customer's price after rebates. */
  value: number;
  solarVictoria: boolean;
  installDate: ISODate | null;
}

export const ROOF_LABEL: Record<RoofType, string> = {
  tin: "Tin (Colorbond)",
  tile: "Tile",
  flat: "Flat roof",
  unsure: "Not sure (quoted as tile)",
};

const num = (v: unknown, min: number, max: number) => (typeof v === "number" && Number.isFinite(v) && v >= min && v <= max ? v : null);

/** The job details from the reserve step, checked. Null when they're unusable. */
export function cleanJobRequest(raw: unknown): JobRequest | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const a = (r.address ?? {}) as Record<string, unknown>;
  const address: Address = {
    line: plainText(a.line, 120),
    suburb: plainText(a.suburb, 60),
    state: plainText(a.state, 3).toUpperCase(),
    postcode: typeof a.postcode === "string" && /^\d{4}$/.test(a.postcode) ? a.postcode : "",
  };
  const lat = num(a.lat, -45, -9);
  const lng = num(a.lng, 110, 155);
  if (lat !== null && lng !== null) Object.assign(address, { lat, lng });
  if (!address.line || !address.suburb || !address.state || !address.postcode) return null;

  const s = (r.system ?? {}) as Record<string, unknown>;
  const panelCount = num(s.panelCount, 0, 200);
  const batteryKwh = num(s.batteryKwh, 0, 200);
  if (panelCount === null || batteryKwh === null || (panelCount === 0 && batteryKwh === 0)) return null;
  const system: SystemConfig = {
    panelCount: Math.round(panelCount),
    batteryKwh,
    evCharger: s.evCharger === true,
    ...(s.existingSolar === true ? { existingSolar: true } : {}),
    ...(s.batteryReady === true ? { batteryReady: true } : {}),
  };

  const site = (r.site ?? {}) as Record<string, unknown>;
  const roof: RoofType = site.roof === "tin" || site.roof === "tile" || site.roof === "flat" ? site.roof : "unsure";
  const installDate = typeof r.installDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(r.installDate) ? r.installDate : null;
  return {
    address,
    system,
    site: {
      storeys: site.storeys === "double" ? "double" : "single",
      roof,
      phase: site.phase === "three" ? "three" : "single",
      ...(roof === "flat" && site.tilt === true ? { tilt: true } : {}),
    },
    packageName: plainText(r.packageName, 80) || "Solar system",
    value: num(r.value, 0, 500_000) ?? 0,
    solarVictoria: r.solarVictoria === true,
    installDate,
  };
}

export function defaultChecklist(system: SystemConfig): ChecklistItem[] {
  return [
    "Site safety assessment",
    "Roof condition photographed",
    "Switchboard inspected",
    ...(system.panelCount > 0 ? ["Array mounted and earthed"] : []),
    "Inverter commissioned",
    ...(system.batteryKwh > 0 ? ["Battery commissioned"] : []),
    "Customer walkthrough",
    "Compliance certificate lodged",
  ].map((label, i) => ({ id: `c${i}`, label, done: false }));
}

export function defaultDocuments(): JobDocument[] {
  return [
    { id: "d1", name: "Network pre-approval", kind: "approval", status: "required" },
    { id: "d2", name: "System design & panel layout", kind: "design", status: "required" },
    { id: "d4", name: "Certificate of compliance", kind: "compliance", status: "required" },
    { id: "d5", name: "Installation photos", kind: "photo", status: "required" },
  ];
}

/** How a job's status shows in the partner portal. */
export function stageFor(status: JobStatus): JobStage {
  if (status === "offered" || status === "unassigned") return "new";
  if (status === "cancelled") return "completed";
  return status;
}

export interface StoredJob {
  id: string;
  reference: string;
  recordKey: string;
  customer: { name: string; phone: string; email: string };
  address: Address;
  system: SystemConfig;
  site: JobRequest["site"];
  packageName: string;
  value: number;
  solarVictoria: boolean;
  installDate: ISODate | null;
  status: JobStatus;
  createdAt: string;
}

/**
 * A stored job as the portal shows it. Until the partner accepts, the
 * customer's name, contact details and street are held back: an offer shows
 * only the suburb, system and date.
 */
export function portalJob(j: StoredJob, offer?: { id: string; expiresAt: string }): Job {
  const offered = j.status === "offered";
  return {
    id: j.id,
    reference: j.reference,
    recordKey: j.recordKey,
    customer: offered ? { name: `New job in ${j.address.suburb}`, phone: "", email: "" } : j.customer,
    address: offered ? { ...j.address, line: "Street shown once you accept", lat: undefined, lng: undefined } : j.address,
    packageName: j.packageName,
    system: j.system,
    solarVictoria: j.solarVictoria,
    stage: stageFor(j.status),
    preferredDate: j.installDate ?? j.createdAt.slice(0, 10),
    windowId: "0700",
    crewId: null,
    value: j.value,
    site: {
      storeys: j.site.storeys,
      roof: ROOF_LABEL[j.site.roof],
      phase: j.site.phase,
      tilt: j.site.tilt,
      orientation: "Confirmed on the call",
      accessNotes: "Confirmed on the customer's call.",
      switchboardNotes: "Photos and notes from the confirmation call appear here.",
      imagery: [],
    },
    checklist: defaultChecklist(j.system),
    documents: defaultDocuments(),
    messages: [],
    activity: [{ id: "a1", at: j.createdAt, label: "Reserved by the customer" }],
    statusHistory: [],
    ...(offer ? { offer } : {}),
  };
}
