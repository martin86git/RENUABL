/**
 * Meta Pixel rules (for Meta ads). The pixel only ever sees public pages and
 * two events: PageView and one Lead when a bill has been read, with no
 * parameters. Private pages are left out because their URLs can carry sign-in
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
