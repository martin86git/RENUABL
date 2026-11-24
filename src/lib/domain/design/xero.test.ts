import { describe, expect, it } from "vitest";
import {
  DEFAULT_XERO_SETTINGS,
  addDays,
  billGoes,
  cleanXeroSettings,
  customerInvoice,
  installerBill,
  progressFromXero,
  scheduleLines,
  type SignedSale,
} from "./xero";

const sale: SignedSale = {
  customer: { name: "Sam Sample", email: "sam@example.com", address: "1 Sample Street, Glen Waverley VIC 3150" },
  title: "Solar and battery",
  system: "6.60 kW solar with a 13.5 kWh battery",
  price: { incGst: 18_000, stc: 3_250.5, youPay: 14_749.5 },
  terms: { deposit: 1_000, milestones: [{ name: "On installation", amount: 13_749.5 }] },
  reference: "RB-ABC123",
};

describe("Xero settings", () => {
  it("starts as drafts on Xero's usual Australian accounts", () => {
    expect(cleanXeroSettings(undefined)).toEqual(DEFAULT_XERO_SETTINGS);
  });
  it("keeps what is valid and drops what isn't", () => {
    const s = cleanXeroSettings({
      status: "AUTHORISED",
      dueDays: 400,
      salesAccount: "41-00",
      billsAccount: "<script>",
      bills: "any",
      stcTax: "OUTPUT",
    });
    expect(s).toMatchObject({
      status: "AUTHORISED",
      dueDays: 90,
      salesAccount: "41-00",
      billsAccount: "310",
      bills: "any",
      stcTax: "OUTPUT",
    });
  });
});

describe("the customer's invoice", () => {
  it("comes to what the customer pays: the price with GST less the STCs", () => {
    const inv = customerInvoice(sale, DEFAULT_XERO_SETTINGS, "2026-11-25");
    const total = inv.LineItems.reduce((s, l) => s + (l.Quantity ?? 0) * (l.UnitAmount ?? 0), 0);
    expect(total).toBeCloseTo(sale.price.youPay, 2);
    expect(inv).toMatchObject({ Type: "ACCREC", LineAmountTypes: "Inclusive", Status: "DRAFT", Reference: "RB-ABC123" });
    expect(inv.LineItems[0]).toMatchObject({ AccountCode: "200", TaxType: "OUTPUT", UnitAmount: 18_000 });
    expect(inv.LineItems[1]).toMatchObject({ UnitAmount: -3_250.5, TaxType: "BASEXCLUDED" });
    expect(inv.Contact).toEqual({ Name: "Sam Sample", EmailAddress: "sam@example.com" });
    expect(inv.DueDate).toBeUndefined();
  });
  it("writes the payment schedule as lines with no amount", () => {
    const inv = customerInvoice(sale, DEFAULT_XERO_SETTINGS, "2026-11-25");
    expect(inv.LineItems.slice(2).map((l) => l.Description)).toEqual([
      "Payment schedule:",
      "Deposit on signing: $1,000.00",
      "On installation: $13,749.50",
    ]);
    expect(inv.LineItems.slice(2).every((l) => l.UnitAmount === undefined)).toBe(true);
  });
  it("gives an approved invoice a due date", () => {
    const inv = customerInvoice(sale, { ...DEFAULT_XERO_SETTINGS, status: "AUTHORISED", dueDays: 7 }, "2026-12-28");
    expect(inv.DueDate).toBe("2027-01-04");
  });
  it("leaves out the rebate line and schedule when there are none", () => {
    const inv = customerInvoice(
      { ...sale, price: { incGst: 9000, stc: 0, youPay: 9000 }, terms: undefined },
      DEFAULT_XERO_SETTINGS,
      "2026-11-25",
    );
    expect(inv.LineItems).toHaveLength(1);
    expect(scheduleLines({ deposit: null, milestones: [] })).toEqual([]);
  });
  it("never carries a cost or margin word", () => {
    const words = JSON.stringify(customerInvoice(sale, DEFAULT_XERO_SETTINGS, "2026-11-25")).toLowerCase();
    expect(words).not.toMatch(/margin|cost/);
  });
});

describe("an installer's bill", () => {
  const inv = {
    installer: "Sparks Electrical",
    number: "INV-77",
    date: "2026-11-20",
    subTotal: 2100,
    gst: 210,
    lines: [
      { description: "Panels", amount: 1800 },
      { description: "Battery", amount: 300 },
    ],
  };
  it("is a draft bill ex GST with the installer's own number", () => {
    const bill = installerBill(inv, DEFAULT_XERO_SETTINGS, "Sam Sample · RB-ABC123", "2026-11-25");
    expect(bill).toMatchObject({
      Type: "ACCPAY",
      Status: "DRAFT",
      LineAmountTypes: "Exclusive",
      InvoiceNumber: "INV-77",
      Date: "2026-11-20",
    });
    expect(bill.LineItems.map((l) => [l.UnitAmount, l.TaxType, l.AccountCode])).toEqual([
      [1800, "INPUT", "310"],
      [300, "INPUT", "310"],
    ]);
  });
  it("carries no GST for an installer who charged none, and one line when it has none", () => {
    const bill = installerBill({ ...inv, gst: 0, lines: [], date: "" }, DEFAULT_XERO_SETTINGS, "x", "2026-11-25");
    expect(bill.LineItems).toEqual([
      { Description: "Installation", Quantity: 1, UnitAmount: 2100, AccountCode: "310", TaxType: "BASEXCLUDED" },
    ]);
    expect(bill.Date).toBe("2026-11-25");
  });
  it("goes when it matches, or whenever, or never", () => {
    expect(billGoes("matched", "match")).toBe(true);
    expect(billGoes("matched", "over")).toBe(false);
    expect(billGoes("any", "under")).toBe(true);
    expect(billGoes("off", "match")).toBe(false);
  });
});

describe("Xero's status on the deal", () => {
  it("reads paid, sent and draft", () => {
    expect(progressFromXero("PAID", 0)).toBe("paid");
    expect(progressFromXero("AUTHORISED", 500)).toBe("pending");
    expect(progressFromXero("DRAFT", 500)).toBe("not-issued");
    expect(progressFromXero("VOIDED", 0)).toBeNull();
  });
  it("adds days across a month and year", () => {
    expect(addDays("2026-02-27", 3)).toBe("2026-03-02");
  });
});
