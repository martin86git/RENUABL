/**
 * Who RENUABL is, for the legal pages, footer and SMS consent. The privacy
 * policy and terms were drafted for launch and must be reviewed by a lawyer.
 */
import { formatAbn } from "./partner";
import { RENUABL_BUSINESS } from "./payouts";

export const LEGAL = {
  company: RENUABL_BUSINESS.name,
  tradingAs: RENUABL_BUSINESS.tradingAs,
  abn: formatAbn(RENUABL_BUSINESS.abn),
  /** Must be a mailbox someone reads: privacy requests and complaints come here. */
  email: "hello@renuabl.com.au",
  state: "Victoria",
  updated: "28 September 2026",
} as const;

/** Shown where customers give their mobile and email (the reserve step). */
export const CONTACT_CONSENT =
  "By reserving, you agree that RENUABL and your installation partner may contact you by phone, SMS and email about your system, call and installation. Message rates may apply. Reply STOP to any text to opt out.";

/** One line for footers: "© 2026 Reburthed Pty Ltd trading as RENUABL · ABN 96 662 374 905". */
export function legalLine(year: number) {
  return `© ${year} ${LEGAL.company} trading as ${LEGAL.tradingAs} · ABN ${LEGAL.abn}`;
}
