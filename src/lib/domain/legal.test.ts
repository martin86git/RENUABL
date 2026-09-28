import { describe, expect, it } from "vitest";
import { CONTACT_CONSENT, LEGAL, legalLine } from "./legal";

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
