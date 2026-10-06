/**
 * Where visitors drop out of the plan. Each flow step sends Meta one custom
 * event the first time it's reached in a visit, so Ads Manager shows how many
 * people got to each step. Fixed names, no parameters, never any details.
 * Pure and tested.
 */

/** Flow route → the custom event sent the first time it's reached in a visit. */
export const FUNNEL_EVENTS = {
  analysing: "StepAddress",
  profile: "StepAboutHome",
  system: "StepSystem",
  extras: "StepExtras",
  installer: "StepPartner",
  date: "StepDate",
  reserve: "StepReserve",
} as const;

/** The event for a flow path such as "/start/system", or null (other pages, the confirmation). */
export function funnelEvent(pathname: string): string | null {
  const m = /^\/start\/([a-z]+)\/?$/.exec(pathname);
  if (!m) return null;
  return (FUNNEL_EVENTS as Record<string, string>)[m[1]] ?? null;
}
