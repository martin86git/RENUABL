import { describe, expect, it } from "vitest";
import {
  CONSENT_VERSION,
  CONTACT_CONSENT,
  FOLLOW_UP_CONSENT,
  LEGAL,
  MARKETING_CONSENT,
  consentRecord,
  legalLine,
  readConsent,
} from "./legal";

describe("legal details", () => {
  it("names the business and its ABN", () => {
    expect(legalLine(2026)).toBe("© 2026 Reburthed Pty Ltd trading as RENUABL · ABN 96 662 374 905");
    expect(LEGAL.email).toMatch(/@renuabl\.com\.au$/);
  });

  it("asks for SMS consent with a way to opt out", () => {
    expect(CONTACT_CONSENT).toContain("SMS");
    expect(CONTACT_CONSENT).toContain("Reply STOP");
  });
});

describe("consent tickboxes", () => {
  const at = new Date("2026-09-30T04:15:00Z");
  it("records what was agreed, when, and the wording version", () => {
    const note = consentRecord({ kind: "reserve", marketing: false, at, timeZone: "Australia/Melbourne" });
    expect(note).toContain("Terms of Use and Privacy Policy");
    expect(note).toContain(CONTACT_CONSENT);
    expect(note).toContain(`wording ${CONSENT_VERSION}`);
    expect(note).toContain("2:15");
    expect(note).toContain("Marketing tips and offers: no.");
    const followUp = consentRecord({ kind: "follow-up", marketing: true, at, timeZone: "Australia/Melbourne" });
    expect(followUp).toContain(FOLLOW_UP_CONSENT);
    expect(followUp).toContain("Marketing tips and offers: yes.");
  });

  it("only counts an explicit tick, and marketing is separate", () => {
    expect(readConsent({ terms: true })).toEqual({ accepted: true, marketing: false });
    expect(readConsent({ terms: "true", marketing: 1 })).toEqual({ accepted: false, marketing: false });
    expect(readConsent(undefined)).toEqual({ accepted: false, marketing: false });
    expect(readConsent({ terms: true, marketing: true })).toEqual({ accepted: true, marketing: true });
  });

  it("keeps marketing optional wording", () => {
    expect(MARKETING_CONSENT).toMatch(/unsubscribe/);
  });
});
