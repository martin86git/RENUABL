import { describe, expect, it } from "vitest";
import { BILLING_ABN_WRONG, BILLING_EMAIL_WRONG, EMPTY_BILLING, cleanBillingDetails, gstIn, taxInvoice } from "./billing-invoice";

const facts = {
  id: "in_1",
  number: "ABCD-0001",
  created: Date.UTC(2026, 10, 1, 2) / 1000,
  paidAt: Date.UTC(2026, 10, 1, 2) / 1000,
  status: "paid",
  totalCents: 8700,
  lines: [{ description: "RENUABL for solar businesses × 3 users", quantity: 3, amountCents: 8700 }],
};

describe("RENUABL's tax invoices", () => {
  it("says tax invoice, names RENUABL with its ABN, and shows the GST inside the price", () => {
    const view = taxInvoice(facts, { ...EMPTY_BILLING, legalName: "Sunrise Solar Pty Ltd", email: "a@example.com" });
    expect(view.title).toBe("Tax invoice");
    expect(view.supplier).toEqual({ name: "Reburthed Pty Ltd", tradingAs: "RENUABL", abn: "96 662 374 905" });
    expect(view.gstCents).toBe(791);
    expect(view.exGstCents + view.gstCents).toBe(8700);
    expect(view.issued).toBe("1 November 2026");
    expect(view.buyer.abn).toBeNull();
  });

  it("asks for the buyer's ABN on an invoice of $1,000 or more", () => {
    const big = taxInvoice({ ...facts, totalCents: 139200 }, { ...EMPTY_BILLING, legalName: "X", email: "a@example.com" });
    expect(big.notes.some((n) => n.includes("ABN"))).toBe(true);
  });

  it("works out GST as one eleventh, to the cent", () => {
    expect(gstIn(2900)).toBe(264);
    expect(gstIn(1100)).toBe(100);
  });

  it("keeps billing details only when whole, checking the ABN", () => {
    expect(cleanBillingDetails({ legalName: " Sunrise  Solar ", abn: "96 662 374 905", email: "Bills@Example.com" })).toEqual({
      ok: true,
      value: { legalName: "Sunrise Solar", abn: "96662374905", email: "bills@example.com", address: "" },
    });
    expect(cleanBillingDetails({ legalName: "X", abn: "12 345 678 901", email: "a@example.com" })).toEqual({
      ok: false,
      message: BILLING_ABN_WRONG,
    });
    expect(cleanBillingDetails({ legalName: "X", email: "nope" })).toEqual({ ok: false, message: BILLING_EMAIL_WRONG });
  });
});
