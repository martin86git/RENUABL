import type { ComplianceKind } from "./compliance";
import { COMPLIANCE_ITEMS } from "./compliance";
import { MIN_PUBLIC_LIABILITY } from "./partner";
import type { ISODate } from "./types";

export const COMPLIANCE_UPLOAD = { types: ["application/pdf", "image/jpeg", "image/png"], maxBytes: 4 * 1024 * 1024 } as const;

export type ComplianceUpdate = { kind: ComplianceKind; expires: ISODate; number?: string; amount?: number };

/** A renewal from the portal: a known kind, a future expiry date, and (for insurance) at least $10M cover. */
export function validateComplianceUpdate(
  raw: { kind?: unknown; expires?: unknown; number?: unknown; amount?: unknown },
  today: ISODate,
): { update: ComplianceUpdate } | { error: string } {
  const kind = COMPLIANCE_ITEMS.find((i) => i.kind === raw.kind)?.kind;
  if (!kind) return { error: "Choose what you're updating." };
  const expires = typeof raw.expires === "string" ? raw.expires : "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(expires) || Number.isNaN(Date.parse(expires))) return { error: "Enter the new expiry date." };
  if (expires <= today) return { error: "That date has passed. Enter the new expiry date." };
  const number =
    typeof raw.number === "string"
      ? raw.number
          .replace(/[^\w\- /]/g, "")
          .trim()
          .slice(0, 40) || undefined
      : undefined;
  if (kind === "public-liability") {
    const amount = Number(raw.amount);
    if (!Number.isFinite(amount) || amount < MIN_PUBLIC_LIABILITY) return { error: "Public liability cover must be at least $10 million." };
    return { update: { kind, expires, number, amount } };
  }
  return { update: { kind, expires, number } };
}
