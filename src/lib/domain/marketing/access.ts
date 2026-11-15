/**
 * Who has Marketing in RENUABL Business (15 Nov 2026, Martin: "I want this available to each retailer… but right now,
 * I only need it for myself"). Every business could have it; for now it is switched on only for RENUABL's own business
 * (the account whose owner is RENUABL_CRM_EMAIL, as the phone assistant is). Opening it to every retailer is
 * MARKETING_FOR_EVERY_RETAILER, plus a price if it is an extra.
 */
import type { Section } from "../design/sections";

export const MARKETING_FOR_EVERY_RETAILER = false;

/** The id of Marketing's page in the Customers section (sections.ts). */
export const MARKETING_PAGE_ID = "marketing";

/** The menu as this business has it: Marketing beside Customers only where it is switched on. */
export function withMarketing(sections: readonly Section[], on: boolean): readonly Section[] {
  return on ? sections : sections.map((s) => ({ ...s, pages: s.pages.filter((p) => p.id !== MARKETING_PAGE_ID) }));
}

/** What a business without it is told. */
export const MARKETING_OFF = "Marketing isn't switched on for your business yet.";
