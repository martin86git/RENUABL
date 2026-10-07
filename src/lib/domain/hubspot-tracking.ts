/**
 * HubSpot's tracking code (the "embed code" from HubSpot settings), for seeing
 * which pages leads visited before they got in touch. Same pages as the ad tags
 * (`pixelAllowedPath`): public pages and the plan, never private pages whose URLs
 * carry sign-in links or record keys, and never the Home Health check.
 * Pure and tested.
 */
import { pixelAllowedPath } from "./meta-pixel";

/** RENUABL's HubSpot account (public: it's in every page's embed code) and its data region. */
export const HUBSPOT_TRACKING = { portalId: "443761924", region: "ap1" } as const;

/** The script HubSpot gives in its embed code, or null when the id isn't a HubSpot id. */
export function hubspotScriptSrc(portalId: string = HUBSPOT_TRACKING.portalId, region: string = HUBSPOT_TRACKING.region) {
  if (!/^\d{4,12}$/.test(portalId) || !/^[a-z]{2,4}\d?$/.test(region)) return null;
  return `https://js-${region}.hs-scripts.com/${portalId}.js`;
}

/** Pages HubSpot may load on and count. */
export const hubspotAllowedPath = (pathname: string) => pixelAllowedPath(pathname);
