import { describe, expect, it } from "vitest";
import { DEAL_EMAIL_TEMPLATES, cleanDealEmail, dealEmail, fillTemplate, senderName } from "./deal-email";

const ctx = {
  firstName: "Jordan",
  lastName: "Placeholder",
  address: "27 Demo Avenue, Werribee VIC 3030",
  business: "Sunny Co",
  sender: "Sam",
};

describe("emailing a customer from their deal", () => {
  it("fills a template with the deal's own words, leaving an unknown token showing", () => {
    expect(fillTemplate("Hi {first_name} at {address}, {sender} from {business}. {nope}", ctx)).toBe(
      "Hi Jordan at 27 Demo Avenue, Werribee VIC 3030, Sam from Sunny Co. {nope}",
    );
    for (const t of DEAL_EMAIL_TEMPLATES) expect(fillTemplate(t.subject + t.body, ctx)).not.toMatch(/\{[a-z_]+\}/);
  });

  it("names the sender from their email", () => {
    expect(senderName("sam.jones@sunny.example")).toBe("Sam");
  });

  it("takes one address, a subject and the words, and refuses the rest", () => {
    expect(cleanDealEmail({ to: " jo@example.com ", subject: "Hi\nthere", body: "Words" })).toEqual({
      ok: true,
      to: "jo@example.com",
      subject: "Hi there",
      body: "Words",
    });
    expect(cleanDealEmail({ to: "jo@example.com, x@example.com", subject: "Hi", body: "W" }).ok).toBe(false);
    expect(cleanDealEmail({ to: "jo@example.com", subject: "", body: "W" }).ok).toBe(false);
    expect(cleanDealEmail({ to: "jo@example.com", subject: "Hi", body: " " }).ok).toBe(false);
  });

  it("sends the words escaped, in paragraphs, saying replies reach the business", () => {
    const e = dealEmail({ business: "Sunny Co", subject: "S", body: "Hi <b>Jo</b>\n\nLine one\nLine two" });
    expect(e.html).toContain("<p>Hi &lt;b&gt;Jo&lt;/b&gt;</p>");
    expect(e.html).toContain("Line one<br>Line two");
    expect(e.text).toContain("Reply to this email to reach Sunny Co.");
  });
});
