/**
 * The Google tag (gtag.js) for Google Ads, in the browser. Loaded only when
 * NEXT_PUBLIC_GOOGLE_ADS_ID is set and only on public pages (the caller checks
 * `pixelAllowedPath`). It sends page views and conversions, nothing else: no
 * values, no enhanced conversions, no customer details.
 */
import { conversionLabel, conversionTarget, googleAdsId, type AdConversion } from "@/lib/domain/google-ads";

const ADS_ID = googleAdsId(process.env.NEXT_PUBLIC_GOOGLE_ADS_ID);
const TARGETS: Record<AdConversion, string | null> = {
  reservation: conversionTarget(ADS_ID, conversionLabel(process.env.NEXT_PUBLIC_GOOGLE_ADS_RESERVATION_LABEL)),
  call: conversionTarget(ADS_ID, conversionLabel(process.env.NEXT_PUBLIC_GOOGLE_ADS_CALL_LABEL)),
  "follow-up": conversionTarget(ADS_ID, conversionLabel(process.env.NEXT_PUBLIC_GOOGLE_ADS_FOLLOW_UP_LABEL)),
};

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
  if (!ADS_ID) return;
  load(ADS_ID);
  window.gtag?.("event", "page_view", { send_to: ADS_ID });
}

/** A conversion happened. Only the conversion itself: no value, no details. */
export function trackGoogleConversion(kind: AdConversion) {
  const target = TARGETS[kind];
  if (!ADS_ID || !target) return;
  load(ADS_ID);
  window.gtag?.("event", "conversion", { send_to: target });
}
