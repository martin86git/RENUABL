import { describe, expect, it } from "vitest";
import { taxInvoice } from "./billing-invoice";
import { aud, brandWords, receiptEmail, receiptFileName } from "./receipt-email";

const view = taxInvoice(
  {
    id: "in_1",
    number: "42LOZAGM-0040",
    created: 1_795_000_000,
    paidAt: 1_795_000_100,
    status: "paid",
    totalCents: 15_345,
    lines: [{ description: "Sol credits · 1,000", quantity: 1, amountCents: 15_345 }],
  },
  { legalName: "Primero Solar Pty Ltd", abn: "", email: "accounts@primero.example", address: "" },
);

describe("the receipt email", () => {
  it("leads with the amount and says how it was paid", () => {
    const m = receiptEmail({ invoice: view, card: { brand: "visa", last4: "9118" }, link: "https://x.test/billing", renews: null });
    expect(m.subject).toBe("Your RENUABL receipt · A$153.45");
    expect(m.text).toContain("with Visa ending 9118");
    expect(m.text).toContain("GST (10%): A$13.95");
    expect(m.text).toContain("Invoice number: 42LOZAGM-0040");
    expect(m.html).toContain("See all your invoices");
  });
  it("says when a plan renews, and leaves the card out when not known", () => {
    const m = receiptEmail({ invoice: view, card: null, link: null, renews: { on: "19 December 2026", cents: 9900 } });
    expect(m.text).toContain("renews on 19 December 2026 for A$99.00");
    expect(m.text).not.toContain("ending");
  });
  it("escapes what came from elsewhere", () => {
    const odd = { ...view, buyer: { ...view.buyer, name: "<b>Acme</b>" } };
    expect(receiptEmail({ invoice: odd, card: null, link: null, renews: null }).html).toContain("&lt;b&gt;Acme");
  });
  it("names things plainly", () => {
    expect(aud(15_345)).toBe("A$153.45");
    expect(brandWords("mastercard")).toBe("Mastercard");
    expect(receiptFileName(view)).toBe("RENUABL tax invoice 42LOZAGM-0040.pdf");
  });
});
