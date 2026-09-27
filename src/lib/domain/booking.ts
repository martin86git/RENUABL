/**
 * HubSpot Meetings: the 15-minute confirmation call is booked by the
 * customer on RENUABL's HubSpot scheduling page, embedded in the app.
 */

/** Accepts only https HubSpot meetings links (e.g. https://meetings.hubspot.com/renuabl/confirmation). */
export function parseHubspotMeetingsUrl(raw: string | undefined): URL | null {
  if (!raw) return null;
  try {
    const url = new URL(raw.trim());
    const hubspot = url.hostname === "hubspot.com" || url.hostname.endsWith(".hubspot.com");
    return url.protocol === "https:" && hubspot ? url : null;
  } catch {
    return null;
  }
}

/**
 * The embeddable form of the link. HubSpot's scheduler pre-fills its form
 * from `firstname`, `lastname` and `email` query parameters when provided.
 */
export function hubspotEmbedSrc(base: URL, prefill: { firstname?: string; lastname?: string; email?: string } = {}): string {
  const url = new URL(base.toString());
  url.searchParams.set("embed", "true");
  for (const [k, v] of Object.entries(prefill)) if (v) url.searchParams.set(k, v);
  return url.toString();
}

/** True when a window message is HubSpot's "meeting booked" event. */
export function isHubspotBookedMessage(origin: string, data: unknown): boolean {
  let host = "";
  try {
    host = new URL(origin).hostname;
  } catch {
    return false;
  }
  if (!(host === "hubspot.com" || host.endsWith(".hubspot.com"))) return false;
  return typeof data === "object" && data !== null && (data as { meetingBookSucceeded?: unknown }).meetingBookSucceeded === true;
}
