/**
 * Meta Pixel rules (for Meta ads). The pixel only ever sees public pages and
 * three events, all without parameters: PageView, BillUploaded (custom) once
 * a bill has been read, and Lead once a date is reserved, when the customer's
 * details reach us. Private pages are left out because their URLs can carry sign-in
 * links or private record keys (/login, /my, /deposit, /installer, /admin).
 * Pure and tested.
 */

/** The pixel ID from NEXT_PUBLIC_META_PIXEL_ID, or null when unset or not a pixel ID (digits only). */
export function metaPixelId(raw: string | undefined): string | null {
  const id = raw?.trim() ?? "";
  return /^\d{10,20}$/.test(id) ? id : null;
}

/** Public pages the pixel may load and count visits on. */
const PIXEL_PATHS = ["/learn", "/start", "/privacy", "/terms", "/contact"];

export function pixelAllowedPath(pathname: string): boolean {
  if (pathname === "/") return true;
  return PIXEL_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

/** The events we send. Lead is the reservation (what HubSpot and staff see); a bill alone is BillUploaded. */
export const META_EVENTS = {
  pageView: "PageView",
  /** Custom event: the bill was read at step 2 (no contact details yet). For audiences and retargeting. */
  billUploaded: "BillUploaded",
  /** Custom event: no bill, they picked a spend range instead (the 7-day trial from 4 Oct 2026). */
  spendEstimated: "SpendEstimated",
  /** Standard event: the date was reserved and the lead is in HubSpot. Ads optimise for this. */
  lead: "Lead",
} as const;
