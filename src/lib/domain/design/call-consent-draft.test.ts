import { describe, expect, it } from "vitest";
import { ASK_LIMITS, askDraft, cleanAskOpening, cleanAskSubject, consentEmail } from "./call-consent";

const names = { business: "Sunrise Solar", assistant: "Gary", firstName: "Casey" };
const link = "https://www.renuabl.com.au/c/abc";

describe("the ask as a draft to read before it goes", () => {
  it("is the email that goes when nothing is changed", () => {
    const d = askDraft(names);
    const e = consentEmail({ ...names, link });
    expect(e.subject).toBe(d.subject);
    for (const part of [...d.opening.split("\n\n"), d.fixed, d.after, d.signOff]) expect(e.text).toContain(part);
    expect(e.html).toContain(d.button);
  });

  it("sends the member's own subject and opening, with the lines that always go", () => {
    const e = consentEmail({
      ...names,
      link,
      subject: "A quick call about your payback question?",
      opening: "Hi Casey,\n\nYou asked about the payback on option 3.\nGary can go through it with you.",
    });
    expect(e.subject).toBe("A quick call about your payback question?");
    expect(e.text).toContain("You asked about the payback on option 3.");
    expect(e.text).not.toContain("Thanks for your interest");
    expect(e.text).toContain("Gary, our automated (AI) phone assistant");
    expect(e.text).toContain(link);
    expect(e.text).toContain("we won't call");
    expect(e.html).toContain("option 3.<br>Gary can go through it");
  });

  it("falls back to ours when theirs is blank", () => {
    const e = consentEmail({ ...names, link, subject: "   ", opening: "\n\n" });
    expect(e.subject).toBe("Would you like a call from Sunrise Solar?");
    expect(e.text).toContain("Hi Casey,");
  });

  it("keeps a subject to one plain line and markup out of the opening", () => {
    expect(cleanAskSubject("Hello\r\nBcc: someone@example.com")).not.toMatch(/[\r\n]/);
    expect(cleanAskSubject("x".repeat(500)).length).toBe(ASK_LIMITS.subject);
    expect(cleanAskSubject(42)).toBe("");
    const e = consentEmail({ ...names, link, opening: 'Hi <script>alert("x")</script> & co' });
    expect(e.html).not.toContain("<script");
    expect(e.html).toContain("&amp; co");
    expect(cleanAskOpening("a\n\n\n\n\nb")).toBe("a\n\nb");
    expect(cleanAskOpening("y".repeat(5000)).length).toBe(ASK_LIMITS.opening);
  });
});
