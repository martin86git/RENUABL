/**
 * Job handover: the photos and serial numbers an installation partner
 * captures on every job. Together they make the home's installation record,
 * shown to the customer in My RENUABL, so whoever works on the system later
 * has its history. Pure and tested.
 */
import { BATTERY } from "./catalogue";
import type { SystemConfig } from "./types";

export type EvidenceId = "roof-before" | "array" | "inverter" | "switchboard" | "commissioning" | "inverter-online";

export const HANDOVER_PHOTOS: { id: EvidenceId; label: string; detail: string }[] = [
  { id: "roof-before", label: "Roof before installation", detail: "Each roof face you'll use, before anything is fitted." },
  { id: "array", label: "Solar arrays installed", detail: "At least one clear photo of each array on the roof." },
  { id: "inverter", label: "Inverter installed", detail: "The inverter (and battery) on the wall, labels readable." },
  { id: "switchboard", label: "Switchboard", detail: "Open, after your work, with the solar and battery circuits labelled." },
  { id: "commissioning", label: "Commissioning completed", detail: "The commissioning screen or report showing the system running." },
  {
    id: "inverter-online",
    label: "Inverter online",
    detail: "The monitoring app or inverter screen showing it's connected to the internet.",
  },
];

export interface HandoverPhoto {
  id: string;
  category: EvidenceId;
  /** For array photos: which array (1-based). */
  array?: number;
  /** Where the photo is stored (server storage path, or a local id on this device). */
  path: string;
  takenAt: string;
}

export interface HandoverRecord {
  /** The job's private record key (in links and storage paths). */
  key: string;
  jobReference: string;
  arrays: number;
  photos: HandoverPhoto[];
  serials: { panels: string[]; inverter: string; batteries: string[] };
  /** Shown on the customer's installation record. */
  summary?: { address?: string; system?: string; installer?: string; installedOn?: string };
  updatedAt: string;
  /** Set when the partner submits the finished handover. */
  submittedAt?: string;
  /** Job documents the partner supplied (e.g. the Certificate of Electrical Safety), one entry per page or file. */
  documents?: HandoverDocument[];
}

export interface HandoverDocument {
  id: string;
  /** Which of the job's documents this is (JobDocument id), and its name, e.g. "Certificate of compliance". */
  docId: string;
  label?: string;
  name: string;
  path: string;
  contentType: string;
  uploadedAt: string;
}

/** Documents and photos partners can send from a phone: PDFs, or photos (shrunk before upload). */
export const DOCUMENT_UPLOAD = { maxBytes: 4 * 1024 * 1024, types: ["application/pdf", "image/jpeg", "image/png"] } as const;
export const MAX_DOCUMENT_FILES = 10;

/** The pages or files supplied for one of the job's documents. */
export function documentFiles(record: Pick<HandoverRecord, "documents">, docId: string) {
  return (record.documents ?? []).filter((d) => d.docId === docId);
}

export const MAX_ARRAYS = 6;
export const RECORD_KEY = /^[a-z0-9]{16,64}$/;

export function emptyHandover(key: string, jobReference: string): HandoverRecord {
  return { key, jobReference, arrays: 1, photos: [], serials: { panels: [], inverter: "", batteries: [] }, updatedAt: "" };
}

/** A serial number: letters, digits and dashes, 6 to 32 long. */
export function isSerial(s: string) {
  return /^[A-Z0-9][A-Z0-9-]{4,30}[A-Z0-9]$/.test(s);
}

/**
 * Serials from pasted or scanned text (one per line, or separated by commas or
 * spaces): upper-cased, with repeats and anything that isn't a serial set aside.
 */
export function parseSerials(text: string): { serials: string[]; duplicates: string[]; invalid: string[] } {
  const serials: string[] = [];
  const duplicates: string[] = [];
  const invalid: string[] = [];
  for (const raw of text.split(/[\s,;]+/)) {
    const s = raw.trim().toUpperCase();
    if (!s) continue;
    if (!isSerial(s)) invalid.push(s);
    else if (serials.includes(s)) duplicates.push(s);
    else serials.push(s);
  }
  return { serials, duplicates, invalid };
}

/** How many battery modules the job has. */
export function batteryModuleCount(system: Pick<SystemConfig, "batteryKwh">) {
  return system.batteryKwh > 0 ? Math.ceil(system.batteryKwh / BATTERY.module.kwh) : 0;
}

export interface HandoverItem {
  id: string;
  label: string;
  done: boolean;
  detail: string;
}

/** Everything still needed before the handover can be submitted. */
export function handoverProgress(
  record: HandoverRecord,
  system: Pick<SystemConfig, "panelCount" | "batteryKwh">,
): { items: HandoverItem[]; complete: boolean } {
  const count = (category: EvidenceId, array?: number) =>
    record.photos.filter((p) => p.category === category && (array === undefined || p.array === array)).length;
  const items: HandoverItem[] = [];
  for (const photo of HANDOVER_PHOTOS) {
    if (photo.id === "array") {
      for (let a = 1; a <= record.arrays; a++) {
        const n = count("array", a);
        items.push({
          id: `array-${a}`,
          label: `Array ${a} installed`,
          done: n > 0,
          detail: n ? `${n} photo${n > 1 ? "s" : ""}` : "Photo needed",
        });
      }
    } else {
      const n = count(photo.id);
      items.push({ id: photo.id, label: photo.label, done: n > 0, detail: n ? `${n} photo${n > 1 ? "s" : ""}` : "Photo needed" });
    }
  }
  const panels = record.serials.panels.length;
  items.push({
    id: "panel-serials",
    label: "Panel serial numbers",
    done: system.panelCount === 0 || panels === system.panelCount,
    detail: `${panels} of ${system.panelCount}`,
  });
  items.push({
    id: "inverter-serial",
    label: "Inverter serial number",
    done: isSerial(record.serials.inverter),
    detail: record.serials.inverter || "Needed",
  });
  const modules = batteryModuleCount(system);
  if (modules > 0) {
    const n = record.serials.batteries.length;
    items.push({ id: "battery-serials", label: "Battery serial numbers", done: n === modules, detail: `${n} of ${modules} modules` });
  }
  return { items, complete: items.every((i) => i.done) };
}

/** A handover sent from the portal, cleaned: known fields only, valid serials, sane counts. Photos are kept from the stored record. */
export function cleanHandoverUpdate(raw: unknown): { arrays: number; serials: HandoverRecord["serials"] } | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as { arrays?: unknown; serials?: { panels?: unknown; inverter?: unknown; batteries?: unknown } };
  const arrays = typeof r.arrays === "number" && Number.isInteger(r.arrays) ? Math.min(MAX_ARRAYS, Math.max(1, r.arrays)) : 1;
  const list = (v: unknown, max: number) =>
    Array.isArray(v)
      ? parseSerials(
          v
            .filter((x) => typeof x === "string")
            .slice(0, max)
            .join("\n"),
        ).serials
      : [];
  const inverter = typeof r.serials?.inverter === "string" ? r.serials.inverter.trim().toUpperCase().slice(0, 32) : "";
  return {
    arrays,
    serials: {
      panels: list(r.serials?.panels, 200),
      inverter: isSerial(inverter) ? inverter : "",
      batteries: list(r.serials?.batteries, 50),
    },
  };
}
