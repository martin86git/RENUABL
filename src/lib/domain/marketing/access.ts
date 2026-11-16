/**
 * Who has Marketing in RENUABL Business (15 Nov 2026, Martin: "I want this available to each retailer"; 16 Nov 2026:
 * marketing emails "will be extra"). It is a retailer's paid add-on (domain/design/add-ons.ts); RENUABL's own business
 * has it always. Every retailer sees the page; one without the add-on sees it offered there (Add to your plan).
 */
import type { Section } from "../design/sections";

/** The id of Marketing's page in the Customers section (sections.ts). */
export const MARKETING_PAGE_ID = "marketing";

/** The menu as this business has it: Marketing beside Customers for every retailer (`on`: signed in to a business). */
export function withMarketing(sections: readonly Section[], on: boolean): readonly Section[] {
  return on ? sections : sections.map((s) => ({ ...s, pages: s.pages.filter((p) => p.id !== MARKETING_PAGE_ID) }));
}

/** What a business without it is told. */
export const MARKETING_OFF = "Marketing email isn't on your plan. Add it in Settings → Billing.";
