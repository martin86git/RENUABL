import { describe, expect, it } from "vitest";
import { recommendSystem } from "./recommendation";
import { billFromSpend, isIndicative, SPEND_BANDS, SPEND_COPY, spendBandLabel, spendDescription } from "./spend-estimate";

describe("spend estimate", () => {
  it("labels the bands for the billing period", () => {
    expect(spendBandLabel("low", "monthly")).toBe("Up to $150");
    expect(spendBandLabel("medium", "two-monthly")).toBe("$300–$600");
    expect(spendBandLabel("very-high", "quarterly")).toBe("Over $1,350");
    expect(spendDescription("quarterly", "high")).toBe("$900–$1,350 a quarter");
  });

  it("the same monthly spend gives the same home whatever the billing period", () => {
    expect(billFromSpend("monthly", "medium").dailyUsageKwh).toBe(billFromSpend("quarterly", "medium").dailyUsageKwh);
  });

  it("bigger spend, bigger use, within sensible limits", () => {
    const daily = SPEND_BANDS.map((b) => billFromSpend("monthly", b.id).dailyUsageKwh);
    for (let i = 1; i < daily.length; i++) expect(daily[i]).toBeGreaterThan(daily[i - 1]);
    expect(daily[0]).toBeGreaterThanOrEqual(6);
    expect(daily[daily.length - 1]).toBeLessThanOrEqual(60);
    // $150–$300 a month is a typical Victorian family home: about 15–30 kWh a day.
    expect(daily[1]).toBeGreaterThan(15);
    expect(daily[1]).toBeLessThan(30);
  });

  it("is marked indicative, never a real bill, and sizes a system", () => {
    const bill = billFromSpend("two-monthly", "high");
    expect(isIndicative(bill)).toBe(true);
    expect(isIndicative({ ...bill, estimate: undefined })).toBe(false);
    expect(bill.hasSolar).toBe(false);
    expect(bill.retailer).toBeNull();
    const rec = recommendSystem(
      { ev: false, evPlanned: false, wantsBattery: true, backup: false },
      { storeys: "single", roof: "Colorbond", orientation: "North", maxPanels: 36 },
      bill,
    );
    expect(rec.tiers.recommended.config.panelCount).toBeGreaterThan(0);
  });

  it("says plainly that the bill is the most accurate and this is indicative", () => {
    expect(SPEND_COPY.billBadge).toBe("Most accurate");
    for (const line of [SPEND_COPY.chosen, SPEND_COPY.savingsNote, SPEND_COPY.priceNote]) expect(line).toMatch(/indicative/i);
    expect(JSON.stringify(SPEND_COPY)).not.toMatch(/exact|precise|guarantee/i);
  });
});

describe("indicative everywhere it shows", () => {
  it("Revo says it's from what they spend", async () => {
    const { revoLine } = await import("./revo");
    expect(revoLine({ step: "profile", dailyKwh: 21, indicative: true })).toContain("from what you spend");
    expect(revoLine({ step: "system", indicative: true })).toContain("indicative");
  });

  it("the order email says the price is indicative", async () => {
    const { cleanOrder, orderConfirmationEmail, INDICATIVE_PRICE_NOTE } = await import("./emails");
    const order = cleanOrder({
      lines: [{ label: "Solar", amount: 9000 }],
      gross: 9000,
      rebates: [],
      total: 9000,
      deposit: 499,
      indicative: true,
    })!;
    const mail = orderConfirmationEmail({ ...order, reference: "RN-1", firstName: "Sam" });
    expect(mail.text).toContain(INDICATIVE_PRICE_NOTE);
    const plain = cleanOrder({ lines: [{ label: "Solar", amount: 9000 }], gross: 9000, rebates: [], total: 9000, deposit: 499 })!;
    expect(orderConfirmationEmail({ ...plain, reference: "RN-1", firstName: "Sam" }).text).not.toContain("indicative");
  });
});
