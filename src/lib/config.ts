import { parseHubspotMeetingsUrl } from "@/lib/domain/booking";

/**
 * Deployment-level settings read from environment variables.
 *
 * NEXT_PUBLIC_PREVIEW_MODE defaults to on: every deployment shows a
 * "sample data" banner and asks search engines not to index it. Set it to
 * "false" only once real data, payments and legal terms are in place.
 */
export const PREVIEW_MODE = process.env.NEXT_PUBLIC_PREVIEW_MODE !== "false";

/**
 * NEXT_PUBLIC_HUBSPOT_MEETINGS_URL: RENUABL's HubSpot scheduling page for the
 * 15-minute confirmation call (e.g. https://meetings.hubspot.com/renuabl/confirmation).
 * When unset or invalid, the confirmation screen says we'll be in touch instead.
 */
export const HUBSPOT_MEETINGS_URL = parseHubspotMeetingsUrl(process.env.NEXT_PUBLIC_HUBSPOT_MEETINGS_URL);
