import { describe, expect, it } from "vitest";
import {
  askRefusal,
  CALL_CONSENT_VERSION,
  CONSENT_DAYS,
  consentEmail,
  consentRecordLine,
  consentState,
  consentWords,
  isConsentToken,
  readConsentAnswer,
} from "./call-consent";

const names = { business: "Sunrise Solar", assistant: "Charlie", firstName: "Jo" };

describe("asking before the assistant calls", () => {
  it("says plainly who would call, that it is automated, and that notes are kept, never that it is recorded", () => {
    const w = consentWords(names);
    expect(w).toContain("Charlie, Sunrise Solar's automated (AI) phone assistant");
    expect(w).toContain("isn't a person");
    expect(w).toContain("notes of the call are kept");
    expect(w).not.toMatch(/record/i);
  });

  it("emails one link, names the business and the assistant, and says what a no means", () => {
    const e = consentEmail({ ...names, link: "https://www.renuabl.com.au/c/abc" });
    expect(e.subject).toBe("Would you like a call from Sunrise Solar?");
    expect(e.text).toContain("Hi Jo,");
    expect(e.text).toContain("automated (AI) phone assistant");
    expect(e.text).toContain("https://www.renuabl.com.au/c/abc");
    expect(e.text).toContain("we won't call");
    expect(e.html).toContain('href="https://www.renuabl.com.au/c/abc"');
    expect(e.html).not.toContain("<script");
  });

  it("keeps markup out of the business's name in the email", () => {
    const e = consentEmail({ business: "<b>Bad</b>", assistant: "Charlie", link: "https://x/c/1" });
    expect(e.html).not.toContain("<b>");
  });

  it("is waiting, answered or lapsed", () => {
    const asked = new Date("2026-11-01T00:00:00Z");
    expect(consentState({ answer: null, askedAt: asked }, new Date("2026-11-02T00:00:00Z"))).toBe("waiting");
    expect(consentState({ answer: "yes", askedAt: asked }, new Date("2027-01-01T00:00:00Z"))).toBe("yes");
    const late = new Date(asked.getTime() + (CONSENT_DAYS + 1) * 86_400_000);
    expect(consentState({ answer: null, askedAt: asked }, late)).toBe("lapsed");
  });

  it("reads only yes or no", () => {
    expect(readConsentAnswer("yes")).toBe("yes");
    expect(readConsentAnswer("no")).toBe("no");
    expect(readConsentAnswer("YES")).toBeNull();
    expect(readConsentAnswer(undefined)).toBeNull();
  });

  it("keeps the words agreed to and the version on the deal", () => {
    const line = consentRecordLine({ kind: "yes", assistant: "Charlie", words: consentWords(names) });
    expect(line).toContain(consentWords(names));
    expect(line).toContain(CALL_CONSENT_VERSION);
    expect(consentRecordLine({ kind: "no", assistant: "Charlie", words: "" })).toContain("won't call");
  });

  it("refuses an ask without calls on, a mobile, an email, or after a no or while one waits", () => {
    const ok = { callsOn: true, email: "jo@example.com", mobile: "+61491570156", last: null };
    expect(askRefusal(ok)).toBeNull();
    expect(askRefusal({ ...ok, callsOn: false })).toBe("off");
    expect(askRefusal({ ...ok, mobile: "" })).toBe("no-number");
    expect(askRefusal({ ...ok, email: "not an email" })).toBe("no-email");
    expect(askRefusal({ ...ok, last: "no" })).toBe("said-no");
    expect(askRefusal({ ...ok, last: "waiting" })).toBe("waiting");
    expect(askRefusal({ ...ok, last: "lapsed" })).toBeNull();
    expect(askRefusal({ ...ok, last: "yes" })).toBeNull();
  });

  it("knows its own tokens", () => {
    expect(isConsentToken("a".repeat(40))).toBe(true);
    expect(isConsentToken("a".repeat(39))).toBe(false);
    expect(isConsentToken("../etc")).toBe(false);
  });
});
