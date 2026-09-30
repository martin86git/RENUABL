"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { pixelAllowedPath } from "@/lib/domain/meta-pixel";
import { trackPageView } from "@/lib/services/meta-pixel";

/** Counts visits to public pages for Meta ads (nothing on private pages). */
export function MetaPixel() {
  const pathname = usePathname();
  useEffect(() => {
    if (pathname && pixelAllowedPath(pathname)) trackPageView();
  }, [pathname]);
  return null;
}
