/**
 * The pickup slip: what the installer shows at each wholesaler's counter as
 * evidence of what has been ordered for a job. One page a wholesaler: the
 * business that ordered, our purchase order reference (PO), the wholesaler's
 * own sales order number (SO), the collection day, and every item with its
 * code and quantity, with lines to sign when it is collected.
 *
 * It goes to a wholesaler, so it carries nothing of the customer: no name,
 * phone or email, only the suburb the job is in. No prices either: what was
 * paid is between the business and its wholesaler. Pure, tested.
 */
import type { ISODate } from "../types";

export interface PickupSlipInput {
  business: string;
  /** Our purchase order reference for the job. */
  reference: string;
  installDate: ISODate | null;
  /** The job's address: only its suburb goes on the slip. */
  address: string;
  installer: string | null;
  orderedAt: string | null;
  /** The order's items by wholesaler (supplier null: none set yet), each with that wholesaler's SO number ("" until entered). */
  groups: { supplier: string | null; so: string; items: { qty: number; item: string; sku: string }[] }[];
}

export interface SlipPage {
  wholesaler: string;
  /** "" until the business types it on the Ordering Station. */
  so: string;
  items: { qty: number; item: string; sku: string }[];
  /** How many units in all. */
  units: number;
}

export interface PickupSlip {
  business: string;
  reference: string;
  installDate: ISODate | null;
  suburb: string;
  installer: string | null;
  /** The day the order was marked ordered, YYYY-MM-DD, or null. */
  orderedOn: ISODate | null;
  pages: SlipPage[];
  /** Items no wholesaler has been set for: not on any slip, so the installer knows they still need sourcing. */
  unsourced: { qty: number; item: string; sku: string }[];
}

/** "1/8 Sample St, Kilsyth VIC 3137" → "Kilsyth VIC 3137": where the job is, never the street. */
export function suburbOf(address: string): string {
  const parts = address
    .split(",")
    .map((p) => p.trim())
    .filter((p) => p && p.toLowerCase() !== "australia");
  // A state and postcode written as their own parts ("Glen Waverley, VIC, 3150") belong to the suburb before them.
  let from = parts.length;
  while (from > 0 && /^([a-z]{2,3}|\d{4}|[a-z]{2,3} \d{4})$/i.test(parts[from - 1])) from--;
  from--;
  // The first part is the street (or all there is to tell a suburb from): left off rather than given away.
  return from < 1 ? "" : parts.slice(from).join(" ");
}

export function pickupSlip(input: PickupSlipInput): PickupSlip {
  const pages = input.groups
    .filter((g) => g.supplier && g.items.length)
    .map((g) => ({
      wholesaler: g.supplier!,
      so: g.so.trim(),
      items: g.items.filter((i) => i.qty > 0),
      units: g.items.reduce((n, i) => n + Math.max(0, i.qty), 0),
    }))
    .filter((p) => p.items.length);
  return {
    business: input.business,
    reference: input.reference,
    installDate: input.installDate,
    suburb: suburbOf(input.address),
    installer: input.installer,
    orderedOn: input.orderedAt ? (input.orderedAt.slice(0, 10) as ISODate) : null,
    pages,
    unsourced: input.groups.filter((g) => !g.supplier).flatMap((g) => g.items.filter((i) => i.qty > 0)),
  };
}

/** "PO-ABC123" as it is; a typed "4471" reads "PO 4471". */
export const poText = (po: string) => (/^po[s#:-]/i.test(po.trim()) ? po.trim() : `PO ${po.trim()}`);
/** The line each wholesaler's group carries on the calendar event: both references, so either finds the order. */
export const referenceLine = (po: string, so: string) =>
  [po.trim() && poText(po), so.trim() ? `SO ${so.trim()}` : "SO number not entered yet"].filter(Boolean).join(" · ");
