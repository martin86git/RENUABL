/**
 * HubSpot's tracking code in the browser. Loaded once, on a page `hubspotAllowedPath`
 * allows; it counts that first page itself, and we count later page changes there
 * (it doesn't follow in-app navigation on its own). Never loaded on private pages.
 */
import { hubspotScriptSrc } from "@/lib/domain/hubspot-tracking";

declare global {
  interface Window {
    _hsq?: unknown[][];
  }
}

let loadedOn: string | null = null;

export function hubspotLoaded() {
  return loadedOn !== null;
}

/** A visit to an allowed page: loads the script the first time, then counts each new page. */
export function trackHubspotPage(path: string) {
  const src = hubspotScriptSrc();
  if (!src || typeof document === "undefined") return;
  window._hsq ??= [];
  if (loadedOn === null) {
    loadedOn = path;
    const script = document.createElement("script");
    script.id = "hs-script-loader";
    script.async = true;
    script.defer = true;
    script.src = src;
    document.head.appendChild(script);
    return;
  }
  if (path === loadedOn) return;
  loadedOn = path;
  window._hsq.push(["setPath", path]);
  window._hsq.push(["trackPageView"]);
}
