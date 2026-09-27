export const FLOW_STEPS = [
  { slug: "profile", title: "Your home", short: "Home" },
  { slug: "system", title: "Your system", short: "System" },
  { slug: "installer", title: "Your installer", short: "Installer" },
  { slug: "date", title: "Installation date", short: "Date" },
  { slug: "reserve", title: "Reserve", short: "Reserve" },
  { slug: "confirm", title: "Confirmation call", short: "Confirm" },
] as const;

export type FlowSlug = (typeof FLOW_STEPS)[number]["slug"];

export function stepIndex(slug: string) {
  return FLOW_STEPS.findIndex((s) => s.slug === slug);
}

export function stepHref(slug: FlowSlug) {
  return `/start/${slug}`;
}
