/**
 * Whether RENUABL Business is out in the open (3 Nov 2026, Martin: "remove the RENUABL Business link in the nav on the
 * live website, we're not ready yet for people to see it"; 5 Nov 2026: "I don't want it to be discoverable on
 * renuabl.com.au", reached only by typing /design or /crm). While false: the homeowner top bar and mobile menu don't
 * show "For solar businesses", `/business` is left out of the sitemap and asks search engines not to index it, and
 * robots.txt keeps crawlers out of `/business`, `/design` and `/crm`. Every page still opens for anyone given the
 * address. Set to true at launch.
 */
export const BUSINESS_LINK_SHOWN = false;

/** The addresses RENUABL Business answers at, kept out of search while it isn't launched. */
export const BUSINESS_PATHS = ["/business", "/design", "/crm"] as const;
