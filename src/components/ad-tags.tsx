"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";
import type { GoogleAdsConfig } from "@/lib/domain/google-ads";
import { funnelEvent } from "@/lib/domain/funnel";
import { hubspotAllowedPath } from "@/lib/domain/hubspot-tracking";
import { pixelAllowedPath } from "@/lib/domain/meta-pixel";
import { trackGooglePageView, setGoogleAds } from "@/lib/services/google-ads";
import { hubspotLoaded, trackHubspotPage } from "@/lib/services/hubspot-tracking";
import { trackFunnelStep, trackPageView } from "@/lib/services/meta-pixel";

/** Counts visits to public pages for Meta, Google ads and HubSpot (nothing on private pages), and each flow step reached. */
export function AdTags({ googleAds }: { googleAds: GoogleAdsConfig }) {
  const pathname = usePathname();
  useEffect(() => {
    setGoogleAds(googleAds);
  }, [googleAds]);
  useEffect(() => {
    if (!pathname) return;
    if (hubspotAllowedPath(pathname)) trackHubspotPage(pathname);
    // HubSpot's script can't be unloaded: moving from a public page to a private one (or the Home Health check)
    // reloads it, so the private page opens without it.
    else if (hubspotLoaded()) window.location.reload();
    if (!pixelAllowedPath(pathname)) return;
    trackPageView();
    trackGooglePageView();
    // Each flow step once a visit, so Ads Manager shows where people stop.
    const step = funnelEvent(pathname);
    if (step) trackFunnelStep(step);
  }, [pathname]);
  return null;
}
