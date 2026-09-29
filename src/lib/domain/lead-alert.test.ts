import { describe, expect, it } from "vitest";
import { DEFAULT_LEAD_ALERT_EMAIL, leadAlertRecipients, newLeadEmail } from "./emails";

describe("lead alerts", () => {
  it("go to Martin unless LEAD_ALERT_EMAILS names others", () => {
    expect(leadAlertRecipients(undefined)).toEqual([DEFAULT_LEAD_ALERT_EMAIL]);
    expect(DEFAULT_LEAD_ALERT_EMAIL).toBe("martin@renuabl.com.au");
    expect(leadAlertRecipients(" A@x.com, b@y.com.au ,not-an-email, a@x.com")).toEqual(["a@x.com", "b@y.com.au"]);
    expect(leadAlertRecipients("nonsense")).toEqual([DEFAULT_LEAD_ALERT_EMAIL]);
  });

  it("list the reservation's contact and details, escaped", () => {
    const mail = newLeadEmail({
      kind: "reservation",
      reference: "RN-1234",
      name: "Richard Perez",
      email: "richard@example.com",
      mobile: "0412 345 678",
      details: { System: "8.6 kW solar + 16 kWh battery", Home: "2 Hanwell Court <b>", Empty: "" },
    });
    expect(mail.subject).toBe("New reservation RN-1234: Richard Perez");
    expect(mail.text).toContain("Mobile: 0412 345 678");
    expect(mail.text).toContain("System: 8.6 kW solar + 16 kWh battery");
    expect(mail.text).not.toContain("Empty");
    expect(mail.html).not.toContain("<b>");
  });

  it("flag a no-bill lead for follow-up", () => {
    const mail = newLeadEmail({ kind: "no-bill", email: "sam@example.com", details: { Home: "Glen Waverley" } });
    expect(mail.subject).toBe("New lead (no bill yet): sam@example.com");
    expect(mail.text).toContain("follow-up");
  });
});
