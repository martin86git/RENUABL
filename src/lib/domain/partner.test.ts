import { describe, expect, it } from "vitest";
import {
  MIN_PUBLIC_LIABILITY,
  SUPPLY_ITEMS,
  distanceKm,
  formatAbn,
  isAccreditationNumber,
  isValidAbn,
  normaliseWebsite,
  rateComparison,
  solarRateFor,
  suggestedRates,
  validatePartnerApplication,
} from "./partner";

const base = { line: "10 Waverley Road", suburb: "Malvern East", state: "VIC", postcode: "3145", lat: -37.876, lng: 145.056 };
const good = {
  type: "installer",
  fullName: "Jordan Lee",
  email: "Jordan@Example.com.au",
  mobile: "0412 345 678",
  businessName: "Lee Solar Pty Ltd",
  abn: "51 824 753 556",
  website: "leesolar.com.au",
  businessAddress: "10 Waverley Road, Malvern East VIC 3145",
  base,
  radiusKm: 40,
  accreditationNumber: "a1234567",
  electricalLicence: "REC 12345",
  insurance: { publicLiability: 20_000_000, expires: "2027-06-30" },
  rates: suggestedRates(),
};
const opts = { today: "2026-09-27", hasCertificate: true };

describe("partner credentials", () => {
  it("checks ABNs with the ATO checksum", () => {
    expect(isValidAbn("51 824 753 556")).toBe(true);
    expect(isValidAbn("51824753557")).toBe(false);
    expect(isValidAbn("1234")).toBe(false);
    expect(formatAbn("51824753556")).toBe("51 824 753 556");
  });

  it("accepts accreditation numbers like A1234567", () => {
    expect(isAccreditationNumber("A1234567")).toBe(true);
    expect(isAccreditationNumber("S 123456")).toBe(true);
    expect(isAccreditationNumber("1234567")).toBe(false);
  });

  it("tidies websites and rejects junk", () => {
    expect(normaliseWebsite("leesolar.com.au")).toBe("https://leesolar.com.au");
    expect(normaliseWebsite("https://www.leesolar.com.au/")).toBe("https://www.leesolar.com.au");
    expect(normaliseWebsite("not a site")).toBeNull();
  });
});

describe("partner application", () => {
  it("accepts a complete installer and normalises it", () => {
    const r = validatePartnerApplication(good, opts);
    expect("application" in r).toBe(true);
    if (!("application" in r)) return;
    expect(r.application.email).toBe("jordan@example.com.au");
    expect(r.application.mobile).toBe("+61412345678");
    expect(r.application.abn).toBe("51824753556");
    expect(r.application.accreditationNumber).toBe("A1234567");
    expect(r.application.website).toBe("https://leesolar.com.au");
    expect(r.application.supply).toBeUndefined();
  });

  it("needs $10 million public liability, current cover and a certificate", () => {
    const r = validatePartnerApplication(
      { ...good, insurance: { publicLiability: 5_000_000, expires: "2026-01-01" } },
      { ...opts, hasCertificate: false },
    );
    expect("errors" in r && r.errors.publicLiability).toBeTruthy();
    expect("errors" in r && r.errors.expires).toBeTruthy();
    expect("errors" in r && r.errors.certificate).toBeTruthy();
    expect(MIN_PUBLIC_LIABILITY).toBe(10_000_000);
  });

  it("catches rate typos and a close-to-home rate above the standard rate", () => {
    const typo = validatePartnerApplication({ ...good, rates: { ...good.rates, solarPerWatt: 30 } }, opts);
    expect("errors" in typo && typo.errors.rates).toMatch(/too high/);
    const inverted = validatePartnerApplication({ ...good, rates: { ...good.rates, nearHomePerWatt: 0.4 } }, opts);
    expect("errors" in inverted && inverted.errors.rates).toMatch(/no higher/);
  });

  it("asks retailers for every product cost and a margin", () => {
    const missing = validatePartnerApplication({ ...good, type: "retailer" }, opts);
    expect("errors" in missing && missing.errors.supply).toBeTruthy();
    const costs = Object.fromEntries(SUPPLY_ITEMS.map((i) => [i.sku, i.suggested]));
    const ok = validatePartnerApplication({ ...good, type: "retailer", supply: { costs, margin: 0.18 } }, opts);
    expect("application" in ok && ok.application.supply?.margin).toBe(0.18);
  });

  it("wants a base address and a sensible radius", () => {
    const r = validatePartnerApplication({ ...good, base: undefined, radiusKm: 500 }, opts);
    expect("errors" in r && r.errors.base).toBeTruthy();
    expect("errors" in r && r.errors.radiusKm).toBeTruthy();
  });
});

describe("partner rates", () => {
  it("suggests today's pricing, with a sharper close-to-home rate", () => {
    const s = suggestedRates();
    expect(s.solarPerWatt).toBe(0.3);
    expect(s.nearHomePerWatt).toBeLessThan(s.solarPerWatt);
    expect(s.nearHomeKm).toBe(10);
    expect(s.batteryExtraModule).toBe(300);
  });

  it("uses the close-to-home rate only for single-storey homes within range", () => {
    const s = suggestedRates();
    expect(solarRateFor(s, { distanceKm: 6, storeys: "single" })).toBe(s.nearHomePerWatt);
    expect(solarRateFor(s, { distanceKm: 6, storeys: "double" })).toBe(s.solarPerWatt);
    expect(solarRateFor(s, { distanceKm: 25, storeys: "single" })).toBe(s.solarPerWatt);
    expect(solarRateFor(s, { storeys: "single" })).toBe(s.solarPerWatt);
  });

  it("measures distance between two points", () => {
    // Malvern East to Glen Waverley is about 10 km.
    expect(distanceKm(base, { lat: -37.8795, lng: 145.1636 })).toBeGreaterThan(8);
    expect(distanceKm(base, { lat: -37.8795, lng: 145.1636 })).toBeLessThan(12);
  });

  it("nudges gently against the suggestion", () => {
    expect(rateComparison(0.3, 0.3)).toBe("in line");
    expect(rateComparison(0.4, 0.3)).toBe("above");
    expect(rateComparison(0.2, 0.3)).toBe("below");
  });
});

describe("pricing with a partner's rates", () => {
  // Imported here to keep the costing tests in one place for partners.
  it("uses the partner's install rates, close-to-home rate and a retailer's costs and margin", async () => {
    const { billOfMaterials, sellPrice } = await import("./costing");
    const { priceSystem } = await import("./recommendation");
    const job = {
      panelCount: 14,
      batteryKwh: 16,
      evCharger: false,
      roof: "tin" as const,
      storeys: "single" as const,
      phase: "single" as const,
      addOns: [],
    };
    const rates = { ...suggestedRates(), solarPerWatt: 0.35, nearHomePerWatt: 0.28, batteryPerStack: 2000 };
    const labour = (lines: ReturnType<typeof billOfMaterials>, start: string) => lines.find((l) => l.description.startsWith(start))!.total;

    const far = billOfMaterials({ ...job, partner: { rates, distanceKm: 30 } });
    const near = billOfMaterials({ ...job, partner: { rates, distanceKm: 4 } });
    const kw = (14 * 475) / 1000;
    expect(labour(far, "Solar installation")).toBeCloseTo(kw * 1000 * 0.35, 2);
    expect(labour(near, "Solar installation")).toBeCloseTo(kw * 1000 * 0.28, 2);
    expect(labour(far, "Battery installation")).toBe(2000);

    // Without a partner, RENUABL's own rates (30c/W) are unchanged.
    expect(labour(billOfMaterials(job), "Solar installation")).toBeCloseTo(kw * 1000 * 0.3, 2);

    // A retailer's product costs replace RENUABL's, and their margin is used.
    const panel = SUPPLY_ITEMS.find((i) => i.group === "Panels")!;
    const retail = billOfMaterials({ ...job, partner: { rates, supplyCosts: { [panel.sku]: 110 } } });
    expect(retail.find((l) => l.sku === panel.sku)!.unitCost).toBe(110);
    const site = { storeys: "single" as const, roof: "tin" as const, phase: "single" as const };
    const config = { panelCount: 14, batteryKwh: 0, evCharger: false };
    const withMargin = priceSystem(config, site, [], undefined, undefined, { rates, margin: 0.1 });
    const solarCost = withMargin.bom.filter((l) => l.group === "solar").reduce((s, l) => s + l.total, 0);
    expect(withMargin.lines.find((l) => l.id === "solar")!.amount).toBe(sellPrice(solarCost, 0.1));
  });
});

describe("partner sign-up draft", () => {
  it("uses suggestions for blanks, reads cents per watt and percent", async () => {
    const { EMPTY_PARTNER_DRAFT, draftToApplication, draftRates, rateForDisplay } = await import("./partner");
    expect(draftRates(EMPTY_PARTNER_DRAFT)).toEqual(suggestedRates());
    const rates = draftRates({ rates: { solarPerWatt: "34", nearHomePerWatt: " ", doubleStorey: "$450" } });
    expect(rates.solarPerWatt).toBeCloseTo(0.34);
    expect(rates.nearHomePerWatt).toBe(suggestedRates().nearHomePerWatt);
    expect(rates.doubleStorey).toBe(450);
    expect(rateForDisplay("solarPerWatt", 0.3)).toBe(30);

    const app = draftToApplication({ ...EMPTY_PARTNER_DRAFT, type: "retailer", margin: "15", supply: { [SUPPLY_ITEMS[0].sku]: "118" } });
    const supply = app.supply as { costs: Record<string, number>; margin: number };
    expect(supply.margin).toBeCloseTo(0.15);
    expect(supply.costs[SUPPLY_ITEMS[0].sku]).toBe(118);
    expect(supply.costs[SUPPLY_ITEMS[1].sku]).toBe(SUPPLY_ITEMS[1].suggested);
    expect(draftToApplication({ ...EMPTY_PARTNER_DRAFT, type: "installer" }).supply).toBeUndefined();
  });

  it("turns a filled-in draft into a valid application", async () => {
    const { EMPTY_PARTNER_DRAFT, draftToApplication } = await import("./partner");
    const draft = {
      ...EMPTY_PARTNER_DRAFT,
      ...good,
      type: "installer" as const,
      publicLiability: "20000000",
      expires: "2027-06-30",
      rates: {},
      supply: {},
    };
    expect("application" in validatePartnerApplication(draftToApplication(draft), opts)).toBe(true);
  });
});
