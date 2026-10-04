/**
 * The Google tag (gtag.js) for Google Ads, in the browser. Off until the root
 * layout hands over the tag ID read on the server (`setGoogleAds`), and only on
 * public pages (the caller checks `pixelAllowedPath`). It sends page views and
 * conversions, nothing else: no values, no enhanced conversions, no customer details.
 */
import { conversionTarget, type AdConversion, type GoogleAdsConfig } from "@/lib/domain/google-ads";

let config: GoogleAdsConfig = { id: null, labels: { reservation: null, call: null, "follow-up": null } };

/** Set once from the root layout (public IDs only). */
export function setGoogleAds(next: GoogleAdsConfig) {
  config = next;
}

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

let started = false;

function load(id: string) {
  if (started || typeof window === "undefined") return;
  started = true;
  window.dataLayer = window.dataLayer || [];
  window.gtag = function gtag() {
    // gtag.js reads the arguments object itself, as in Google's snippet.
    // eslint-disable-next-line prefer-rest-params
    window.dataLayer!.push(arguments);
  };
  const script = document.createElement("script");
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(id)}`;
  document.head.appendChild(script);
  window.gtag("js", new Date());
  // We send page views ourselves, on public pages only.
  window.gtag("config", id, { send_page_view: false, allow_enhanced_conversions: false });
}

/** A visit to a public page (call on every route change to one). */
export function trackGooglePageView() {
  if (!config.id) return;
  load(config.id);
  window.gtag?.("event", "page_view", { send_to: config.id });
}

/** A conversion happened. Only the conversion itself: no value, no details. */
export function trackGoogleConversion(kind: AdConversion) {
  const target = conversionTarget(config.id, config.labels[kind]);
  if (!config.id || !target) return;
  load(config.id);
  window.gtag?.("event", "conversion", { send_to: target });
}
