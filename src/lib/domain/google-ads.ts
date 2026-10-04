/**
 * Google Ads conversion tracking rules. Like the Meta Pixel, the Google tag only
 * runs on public pages and the flow (`pixelAllowedPath`) and only ever says that
 * something happened: a page visit and three conversions, never names, emails,
 * phones, addresses, bills or prices (no enhanced conversions, no values).
 * Pure and tested.
 *
 * Vercel settings (short names, read on the server and handed to the page):
 * GADS_ID (AW-…), and one conversion label per conversion action created in
 * Google Ads (Goals → Conversions): GADS_RESERVATION, GADS_CALL, GADS_FOLLOW_UP.
 * The longer NEXT_PUBLIC_GOOGLE_ADS_* names still work.
 */

/** "AW-123456789", or null when unset or not a Google Ads tag ID. */
export function googleAdsId(raw: string | undefined): string | null {
  const id = raw?.trim() ?? "";
  return /^AW-\d{6,15}$/.test(id) ? id : null;
}

/** A conversion label as Google shows it (letters, digits, _ and -), or null. */
export function conversionLabel(raw: string | undefined): string | null {
  const label = raw?.trim() ?? "";
  return /^[A-Za-z0-9_-]{6,40}$/.test(label) ? label : null;
}

/** What counts, from the strongest: a reserved date, a booked 15-minute call, a "no bill yet" follow-up. */
export type AdConversion = "reservation" | "call" | "follow-up";

export interface GoogleAdsConfig {
  id: string | null;
  labels: Record<AdConversion, string | null>;
}

/** The tag ID and labels from the environment: the short GADS_* names, else the NEXT_PUBLIC_GOOGLE_ADS_* ones. */
export function googleAdsConfig(env: Record<string, string | undefined>): GoogleAdsConfig {
  const pick = (short: string, long: string) => env[short] ?? env[long];
  return {
    id: googleAdsId(pick("GADS_ID", "NEXT_PUBLIC_GOOGLE_ADS_ID")),
    labels: {
      reservation: conversionLabel(pick("GADS_RESERVATION", "NEXT_PUBLIC_GOOGLE_ADS_RESERVATION_LABEL")),
      call: conversionLabel(pick("GADS_CALL", "NEXT_PUBLIC_GOOGLE_ADS_CALL_LABEL")),
      "follow-up": conversionLabel(pick("GADS_FOLLOW_UP", "NEXT_PUBLIC_GOOGLE_ADS_FOLLOW_UP_LABEL")),
    },
  };
}

/** Google's `send_to` for a conversion: "AW-123/abcDEF", or null when that conversion isn't set up. */
export function conversionTarget(id: string | null, label: string | null): string | null {
  return id && label ? `${id}/${label}` : null;
}

/** Where a visitor came from when the link has no utm_source: Google and Meta add their own click IDs. */
export function landingSource(search: string): string | null {
  const params = new URLSearchParams(search);
  const utm = params.get("utm_source")?.trim();
  if (utm) return utm.slice(0, 60);
  if (params.has("gclid") || params.has("gbraid") || params.has("wbraid")) return "google";
  if (params.has("fbclid")) return "meta";
  return null;
}
