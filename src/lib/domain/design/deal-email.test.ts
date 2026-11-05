import { describe, expect, it } from "vitest";
import { DEAL_EMAIL_TEMPLATES, MAX_CC, cleanCc, cleanDealEmail, dealEmail, emailRecord, fillTemplate, senderName } from "./deal-email";

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
      cc: [],
      subject: "Hi there",
      body: "Words",
    });
    expect(cleanDealEmail({ to: "jo@example.com, x@example.com", subject: "Hi", body: "W" }).ok).toBe(false);
    expect(cleanDealEmail({ to: "jo@example.com", subject: "", body: "W" }).ok).toBe(false);
    expect(cleanDealEmail({ to: "jo@example.com", subject: "Hi", body: " " }).ok).toBe(false);
  });

  it("copies in up to five people, checked, never twice or the customer again", () => {
    const sent = cleanDealEmail({
      to: "jo@example.com",
      cc: "Sam@Sunny.example, partner@gmail.com; sam@sunny.example JO@example.com",
      subject: "S",
      body: "B",
    });
    expect(sent.ok && sent.cc).toEqual(["sam@sunny.example", "partner@gmail.com"]);
    expect(cleanCc(["a@x.com", "b@x.com"])).toEqual({ ok: true, cc: ["a@x.com", "b@x.com"] });
    expect(cleanCc("")).toEqual({ ok: true, cc: [] });
    expect(cleanCc(undefined)).toEqual({ ok: true, cc: [] });
    const wrong = cleanCc("sam@sunny.example, not-an-address");
    expect(wrong.ok).toBe(false);
    expect(!wrong.ok && wrong.message).toContain("not-an-address");
    const many = Array.from({ length: MAX_CC + 1 }, (_, i) => `p${i}@x.com`).join(", ");
    expect(cleanCc(many).ok).toBe(false);
    expect(cleanCc(Array.from({ length: MAX_CC }, (_, i) => `p${i}@x.com`)).ok).toBe(true);
  });

  it("sends Sol's drafts to the customer's own address, whatever the browser says", () => {
    const sent = cleanDealEmail({ to: "someone@else.com", subject: "S", body: "B" }, "alex@example.com");
    expect(sent.ok && sent.to).toBe("alex@example.com");
    const none = cleanDealEmail({ to: "someone@else.com", subject: "S", body: "B" }, "");
    expect(none.ok).toBe(false);
  });

  it("lists who was copied in on the record", () => {
    expect(emailRecord("jo@example.com", "Hi", "Words", [], ["sam@sunny.example"])).toBe(
      "Email to jo@example.com (Cc sam@sunny.example): Hi\n\nWords",
    );
    expect(emailRecord("jo@example.com", "Hi", "Words")).toBe("Email to jo@example.com: Hi\n\nWords");
  });

  it("sends the words escaped, in paragraphs, saying replies reach the business", () => {
    const e = dealEmail({ business: "Sunny Co", subject: "S", body: "Hi <b>Jo</b>\n\nLine one\nLine two" });
    expect(e.html).toContain("<p>Hi &lt;b&gt;Jo&lt;/b&gt;</p>");
    expect(e.html).toContain("Line one<br>Line two");
    expect(e.text).toContain("Reply to this email to reach Sunny Co.");
  });
});
