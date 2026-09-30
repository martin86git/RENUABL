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
  updated: "1 October 2026",
} as const;

/**
 * Consent tickboxes. The required box accepts the Terms and Privacy Policy
 * (linked in the UI before this wording) plus contact about the customer's
 * own plan; marketing is a separate, optional box, never ticked for them and
 * never a condition of reserving. Bump CONSENT_VERSION whenever the wording
 * changes: the version is saved with each consent as the record.
 */
export const CONSENT_VERSION = "2026-09-30";

/** Reserve step, after "I've read and accept the Terms of Use and Privacy Policy." */
export const CONTACT_CONSENT =
  "RENUABL and my installation partner may contact me by phone, SMS and email about my system, call and installation. Message rates may apply. Reply STOP to any text to opt out.";

/** "Don't have your bill handy?", after the same Terms and Privacy line. */
export const FOLLOW_UP_CONSENT = "RENUABL may email me about finishing my plan.";

/** The optional box (reserve step and "Don't have your bill handy?"). */
export const MARKETING_CONSENT = "Send me occasional solar tips and offers from RENUABL. You can unsubscribe any time.";

/** The message when the required box isn't ticked. */
export const CONSENT_MISSING = "Please tick the box to accept the Terms of Use and Privacy Policy.";

export type ConsentKind = "reserve" | "follow-up";

/** What the customer agreed to, in plain words, for the HubSpot note (built on the server, with the server's time). */
export function consentRecord(o: { kind: ConsentKind; marketing: boolean; at: Date; timeZone: string }): string {
  const when = new Intl.DateTimeFormat("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: o.timeZone,
    timeZoneName: "short",
  }).format(o.at);
  const contact = o.kind === "reserve" ? CONTACT_CONSENT : FOLLOW_UP_CONSENT;
  return `Ticked "I've read and accept the Terms of Use and Privacy Policy. ${contact}" on ${when} (wording ${CONSENT_VERSION}). Marketing tips and offers: ${o.marketing ? "yes" : "no"}.`;
}

/** The server's reading of the tickboxes: only an explicit true counts. */
export function readConsent(raw: unknown): { accepted: boolean; marketing: boolean } {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  return { accepted: r.terms === true, marketing: r.marketing === true };
}

/** One line for footers: "© 2026 Reburthed Pty Ltd trading as RENUABL · ABN 96 662 374 905". */
export function legalLine(year: number) {
  return `© ${year} ${LEGAL.company} trading as ${LEGAL.tradingAs} · ABN ${LEGAL.abn}`;
}
