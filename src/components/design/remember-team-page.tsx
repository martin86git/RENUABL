"use client";

import { useEffect } from "react";
import { TEAM_COOKIE, TEAM_COOKIE_DAYS } from "@/lib/domain/design/sign-in-page";

/**
 * Remembers this business's sign-in page on the device (TEAM_COOKIE), so the front page, /design and the app opened
 * from the Home Screen come back here while signed out, not to RENUABL's own front page.
 */
export function RememberTeamPage({ segment }: { segment: string }) {
  useEffect(() => {
    try {
      const secure = location.protocol === "https:" ? "; secure" : "";
      document.cookie = `${TEAM_COOKIE}=${segment}; path=/; max-age=${TEAM_COOKIE_DAYS * 86400}; samesite=lax${secure}`;
    } catch {
      // Cookies blocked: nothing is remembered.
    }
  }, [segment]);
  return null;
}
