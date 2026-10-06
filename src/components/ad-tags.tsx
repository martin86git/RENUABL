"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";
import type { GoogleAdsConfig } from "@/lib/domain/google-ads";
import { funnelEvent } from "@/lib/domain/funnel";
import { pixelAllowedPath } from "@/lib/domain/meta-pixel";
import { trackGooglePageView, setGoogleAds } from "@/lib/services/google-ads";
import { trackFunnelStep, trackPageView } from "@/lib/services/meta-pixel";

/** Counts visits to public pages for Meta and Google ads (nothing on private pages), and each flow step reached. */
export function AdTags({ googleAds }: { googleAds: GoogleAdsConfig }) {
  const pathname = usePathname();
  useEffect(() => {
    setGoogleAds(googleAds);
  }, [googleAds]);
  useEffect(() => {
    if (!pathname || !pixelAllowedPath(pathname)) return;
    trackPageView();
    trackGooglePageView();
    // Each flow step once a visit, so Ads Manager shows where people stop.
    const step = funnelEvent(pathname);
    if (step) trackFunnelStep(step);
  }, [pathname]);
  return null;
}
