"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";
import type { GoogleAdsConfig } from "@/lib/domain/google-ads";
import { pixelAllowedPath } from "@/lib/domain/meta-pixel";
import { trackGooglePageView, setGoogleAds } from "@/lib/services/google-ads";
import { trackPageView } from "@/lib/services/meta-pixel";

/** Counts visits to public pages for Meta and Google ads (nothing on private pages). */
export function AdTags({ googleAds }: { googleAds: GoogleAdsConfig }) {
  const pathname = usePathname();
  useEffect(() => {
    setGoogleAds(googleAds);
  }, [googleAds]);
  useEffect(() => {
    if (!pathname || !pixelAllowedPath(pathname)) return;
    trackPageView();
    trackGooglePageView();
  }, [pathname]);
  return null;
}
