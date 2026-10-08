/** The seven customer steps shown in the desktop rail and mobile progress dots. */
export const FLOW_STEPS = [
  { key: "home", title: "Your home", subtitle: "Your address", routes: ["analysing"] },
  { key: "about", title: "About your home", subtitle: "Your bill and a few details", routes: ["profile"] },
  { key: "system", title: "Your system", subtitle: "Sized from your bill", routes: ["system", "extras"] },
  { key: "installer", title: "Installation partner", subtitle: "Matched to your home", routes: ["installer"] },
  { key: "date", title: "Pick a tentative date", subtitle: "Change it any time", routes: ["date"] },
  { key: "secure", title: "Your order and call", subtitle: "Nothing to pay today", routes: ["reserve"] },
  { key: "confirmation", title: "Confirmation", subtitle: "Final details", routes: ["confirmed"] },
] as const;

export const FLOW_ROUTES = ["analysing", "profile", "system", "extras", "installer", "date", "reserve", "confirmed"] as const;
export type FlowSlug = (typeof FLOW_ROUTES)[number];

/** Index of the step (0-6) a route belongs to. */
export function stepIndex(slug: string) {
  return FLOW_STEPS.findIndex((s) => (s.routes as readonly string[]).includes(slug));
}

export function stepHref(slug: FlowSlug) {
  return `/start/${slug}`;
}

/** The route before this one, for the mobile back arrow. */
export function previousHref(slug: string) {
  const i = FLOW_ROUTES.indexOf(slug as FlowSlug);
  if (i <= 0) return "/";
  // Skip the automatic analysing screen when going back.
  const prev = FLOW_ROUTES[i - 1];
  return prev === "analysing" ? "/" : stepHref(prev);
}

/** Where clicking a step in the progress rail goes (step 1 returns to the address). */
export function stepEntryHref(index: number) {
  if (index <= 0) return "/";
  return stepHref(FLOW_STEPS[index].routes[0] as FlowSlug);
}
