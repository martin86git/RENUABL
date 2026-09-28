/**
 * A partner's licences and insurance, and what happens as they expire:
 * reminders ahead of time, and new job offers pause the day anything lapses
 * (jobs already accepted carry on). Pure: the reminder run and the portal use it.
 */
import { MIN_PUBLIC_LIABILITY } from "./partner";
import type { ISODate } from "./types";

export type ComplianceKind = "public-liability" | "electrical-licence" | "accreditation";

export const COMPLIANCE_ITEMS: { kind: ComplianceKind; label: string; detail: string }[] = [
  {
    kind: "public-liability",
    label: "Public liability insurance",
    detail: "At least $10 million, with a current certificate of currency.",
  },
  {
    kind: "electrical-licence",
    label: "Electrical licence",
    detail: "Your A-grade licence (or your business's electrical contractor licence).",
  },
  { kind: "accreditation", label: "Solar Accreditation Australia", detail: "Your installer accreditation (formerly CEC)." },
];

export interface ComplianceRecord {
  kind: ComplianceKind;
  number?: string;
  /** Public liability only: the cover, in dollars. */
  amount?: number;
  /** Unknown until the partner adds it (sign-up takes licence and accreditation numbers only): on file, no reminders. */
  expires?: ISODate;
  /** The certificate we hold for it, if any. */
  document?: { name: string; uploadedAt: string };
}

export type ComplianceStatus = "current" | "expiring" | "expired" | "missing";

/** Reminders go out this many days before expiry (and on the day). */
export const REMINDER_DAYS = [60, 30, 14, 7, 1, 0] as const;
/** Shown as "expiring" from this many days out. */
export const EXPIRING_WITHIN_DAYS = 30;

export function daysUntil(expires: ISODate, today: ISODate) {
  return Math.round((Date.parse(`${expires}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86_400_000);
}

export function complianceStatus(record: ComplianceRecord | undefined, today: ISODate): ComplianceStatus {
  if (!record) return "missing";
  if (record.kind === "public-liability" && (record.amount ?? 0) < MIN_PUBLIC_LIABILITY) return "expired";
  if (!record.expires) return "current";
  const days = daysUntil(record.expires, today);
  if (days < 0) return "expired";
  // Cover below the minimum counts as lapsed, whatever its date.
  if (record.kind === "public-liability" && (record.amount ?? 0) < MIN_PUBLIC_LIABILITY) return "expired";
  return days <= EXPIRING_WITHIN_DAYS ? "expiring" : "current";
}

/** New offers stop while anything is missing or lapsed. */
export function offersPaused(records: ComplianceRecord[], today: ISODate): { paused: boolean; reasons: string[] } {
  const reasons: string[] = [];
  for (const item of COMPLIANCE_ITEMS) {
    const status = complianceStatus(
      records.find((r) => r.kind === item.kind),
      today,
    );
    if (status === "missing") reasons.push(`${item.label}: not on file`);
    if (status === "expired") reasons.push(`${item.label}: expired`);
  }
  return { paused: reasons.length > 0, reasons };
}

/** The reminders due today (the run is daily, so each fires once). */
export function remindersDue(records: ComplianceRecord[], today: ISODate): { kind: ComplianceKind; label: string; days: number }[] {
  return records.flatMap((r) => {
    if (!r.expires) return [];
    const days = daysUntil(r.expires, today);
    if (!(REMINDER_DAYS as readonly number[]).includes(days)) return [];
    return [{ kind: r.kind, label: COMPLIANCE_ITEMS.find((i) => i.kind === r.kind)!.label, days }];
  });
}

/** "expires in 12 days", "expires tomorrow", "expired 3 days ago". */
export function expiryPhrase(expires: ISODate, today: ISODate) {
  const days = daysUntil(expires, today);
  if (days < -1) return `expired ${-days} days ago`;
  if (days === -1) return "expired yesterday";
  if (days === 0) return "expires today";
  if (days === 1) return "expires tomorrow";
  return `expires in ${days} days`;
}
