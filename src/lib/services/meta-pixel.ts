/**
 * The Meta Pixel in the browser. Loaded only when NEXT_PUBLIC_META_PIXEL_ID is
 * set and only on public pages (`pixelAllowedPath`). Automatic page-view and
 * button tracking are switched off, so the pixel sends exactly what we fire
 * (META_EVENTS): page views, a bill read or a spend range picked, a follow-up
 * request, a booked call and a reservation. No parameters, ever.
 */
import { META_EVENTS, metaPixelId } from "@/lib/domain/meta-pixel";

const PIXEL_ID = metaPixelId(process.env.NEXT_PUBLIC_META_PIXEL_ID);

type Fbq = ((...args: unknown[]) => void) & {
  callMethod?: (...args: unknown[]) => void;
  queue: unknown[];
  push: Fbq;
  loaded: boolean;
  version: string;
  disablePushState?: boolean;
};

declare global {
  interface Window {
    fbq?: Fbq;
    _fbq?: Fbq;
  }
}

let started = false;

/** Meta's standard base code, written out, with its own route-change tracking off (we send PageView ourselves). */
function load(id: string) {
  if (started || typeof window === "undefined") return;
  started = true;
  if (!window.fbq) {
    const fbq = function (...args: unknown[]) {
      if (fbq.callMethod) fbq.callMethod(...args);
      else fbq.queue.push(args);
    } as Fbq;
    fbq.push = fbq;
    fbq.loaded = true;
    fbq.version = "2.0";
    fbq.queue = [];
    window.fbq = fbq;
    window._fbq ??= fbq;
    const script = document.createElement("script");
    script.async = true;
    script.src = "https://connect.facebook.net/en_US/fbevents.js";
    document.head.appendChild(script);
  }
  // Without this the pixel fires its own PageView on every route change, including private pages.
  window.fbq.disablePushState = true;
  // No automatic button-click or page-metadata events.
  window.fbq("set", "autoConfig", false, id);
  window.fbq("init", id);
}

/** A visit to a public page (call on every route change to one). */
export function trackPageView() {
  if (!PIXEL_ID) return;
  load(PIXEL_ID);
  window.fbq?.("track", META_EVENTS.pageView);
}

/** The visitor's bill has been read (step 2). A custom event, no parameters. */
export function trackBillUploaded() {
  if (!PIXEL_ID) return;
  load(PIXEL_ID);
  window.fbq?.("trackCustom", META_EVENTS.billUploaded);
}

/** No bill: the visitor picked a spend range instead. A custom event, no parameters (never the amount). */
export function trackSpendEstimated() {
  if (!PIXEL_ID) return;
  load(PIXEL_ID);
  window.fbq?.("trackCustom", META_EVENTS.spendEstimated);
}

/** No bill yet: they left an email or mobile for us to follow up. Standard Contact event, no parameters. */
export function trackFollowUp() {
  if (!PIXEL_ID) return;
  load(PIXEL_ID);
  window.fbq?.("track", META_EVENTS.contact);
}

/** They booked a 15-minute call with the team. Standard Schedule event, no parameters. */
export function trackCallBooked() {
  if (!PIXEL_ID) return;
  load(PIXEL_ID);
  window.fbq?.("track", META_EVENTS.schedule);
}

/** The date was reserved: the lead and their details are with us (HubSpot, staff email). No parameters are sent. */
export function trackLead() {
  if (!PIXEL_ID) return;
  load(PIXEL_ID);
  window.fbq?.("track", META_EVENTS.lead);
}
