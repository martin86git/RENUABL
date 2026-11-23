/**
 * The designer sideways in a phone's browser (22 Nov 2026, Martin: Safari's tab and address bars took the room). A web page
 * can't hide them; opened from the Home Screen the site runs full screen (manifest.ts, standalone). So the designer says how,
 * once, in the words of the phone's own browser.
 */
export type PhoneBrowser = "ios" | "android";

/** Which phone's browser this is, by its user agent; null for anything else (a computer, or not known). */
export function phoneBrowserOf(userAgent: string, touchPoints = 0): PhoneBrowser | null {
  if (/iPhone|iPad|iPod/i.test(userAgent)) return "ios";
  // An iPad asks for the desktop site and reads as a Mac: it has a touch screen.
  if (/Macintosh/i.test(userAgent) && touchPoints > 1) return "ios";
  if (/Android/i.test(userAgent)) return "android";
  return null;
}

/** The steps to add the site to the Home Screen, in that browser's words. */
export const HOME_SCREEN_STEPS: Record<PhoneBrowser, string> = {
  ios: "Share, then Add to Home Screen",
  android: "the ⋮ menu, then Add to Home screen",
};

export const HOME_SCREEN_LEAD = "For the full screen, open RENUABL from your Home Screen:";
