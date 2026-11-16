import { describe, expect, it } from "vitest";
import {
  cleanPylonId,
  cleanPylonKey,
  dealFromPylon,
  designUrl,
  isPylonPage,
  pdfName,
  progressWords,
  readProjectPage,
  signedDesignId,
  soldProjectsUrl,
} from "./pylon-import";

const project = {
  data: {
    type: "solar_projects",
    id: "rukSigcyTR",
    attributes: {
      reference_number: "PYL-0003-7789",
      site_location: [145.06, -37.86],
      site_address: { line1: "19 Sample Avenue", line2: null, city: "Glen Iris", state: "Victoria", zip: "3147", country: "Australia" },
      customer_details: { name: "Jill Example", phone: "0400 000 000", email: "Jill@Example.com" },
      site_details: {
        roof_type: "tin_corrugated",
        number_of_storeys: 2,
        power_phases: 1,
        building_classification: "residential",
        nmi: "6305123456",
        meter_number: "M123",
        energy_retailer: "Sample Energy",
        energy_distributor: "United Energy",
        dnsp_preapproval_number: "PA-998",
      },
      acceptance: {
        is_accepted: true,
        manually_sold: false,
        latest_esignature: true,
        latest_esignature_pdf_url: "https://files.example.com/signed.pdf?x=1",
      },
    },
    relationships: {
      primary_design: { data: { type: "solar_designs", id: "prim01" } },
      latest_signed_design: { data: { type: "solar_designs", id: "sign01" } },
    },
  },
};

const design = {
  data: {
    type: "solar_designs",
    id: "sign01",
    attributes: {
      title: "6.6 kW Solar + 10 kWh Battery",
      summary: { dc_output_kw: 6.6, storage_kwh: 10.24, pdf_proposal_url: "https://app.getpylon.com/proposal/rukSigcyTR/sign01/pdf" },
      pricing: { total: 1234500, total_includes_tax: true, currency: "aud" },
      proposal_quote: { total_price_formatted: "$12,345.00" },
      module_types: [{ description: "REC Solar TwinPeak 2 Series", quantity: 22 }],
      inverter_types: [
        { description: "Sungrow SH5K", quantity: 1 },
        { description: "Enphase IQ8", quantity: 2 },
      ],
      storage_types: [{ description: "Sonnen Eco 8.10", quantity: 1 }],
      ev_charger_types: [],
      locale: { au: { stc_value: 280000 } },
    },
  },
};

describe("the Pylon key and addresses", () => {
  it("takes a key pasted with Bearer or quotes, and refuses what can't be one", () => {
    expect(cleanPylonKey("  Bearer abcdef0123456789xyz  ")).toBe("abcdef0123456789xyz");
    expect(cleanPylonKey('"abcdef0123456789xyz"')).toBe("abcdef0123456789xyz");
    expect(cleanPylonKey("short")).toBeNull();
    expect(cleanPylonKey("has spaces in the middle of it")).toBeNull();
    expect(cleanPylonKey(42)).toBeNull();
  });

  it("asks only for sold projects, archived ones too, and follows only Pylon's own project pages", () => {
    const url = new URL(soldProjectsUrl());
    expect(url.host).toBe("api.getpylon.com");
    expect(url.searchParams.get("filter[acceptance]")).toBe("is_accepted");
    expect(url.searchParams.get("filter[is_archived]")).toBe("any");
    expect(isPylonPage("https://api.getpylon.com/v1/solar_projects?page[number]=2")).toBe(true);
    expect(isPylonPage("https://evil.example.com/v1/solar_projects")).toBe(false);
    expect(isPylonPage("http://api.getpylon.com/v1/solar_projects")).toBe(false);
    expect(isPylonPage("https://api.getpylon.com/v1/users")).toBe(false);
    expect(designUrl("sign01")).toContain("fields[solar_designs]=");
    expect(cleanPylonId("../etc")).toBeNull();
  });
});

describe("reading Pylon's answers", () => {
  it("reads a page of sold projects, leaving out Pylon's examples, with the next page", () => {
    const page = readProjectPage({
      data: [project.data, { id: "exmpl1", attributes: { is_example: true } }, { id: "bad id!", attributes: {} }],
      links: { next: "https://api.getpylon.com/v1/solar_projects?page[number]=2" },
    });
    expect(page.projects).toEqual([{ id: "rukSigcyTR", reference: "PYL-0003-7789", customer: "Jill Example" }]);
    expect(page.next).toContain("page[number]=2");
    expect(readProjectPage({ data: [], links: { next: "https://elsewhere.example/x" } }).next).toBeNull();
  });

  it("reads the signed design first, else the primary", () => {
    expect(signedDesignId(project)).toBe("sign01");
    const unsigned = { data: { ...project.data, relationships: { primary_design: { data: { id: "prim01" } } } } };
    expect(signedDesignId(unsigned)).toBe("prim01");
  });

  it("makes a customer and a sold deal from a project and its signed design", () => {
    const deal = dealFromPylon(project, design, "won")!;
    expect(deal.pylonId).toBe("rukSigcyTR");
    expect(deal.customer).toMatchObject({
      firstName: "Jill",
      lastName: "Example",
      email: "jill@example.com",
      phone: "0400 000 000",
      source: "Pylon",
    });
    expect(deal.job).toMatchObject({
      title: "Solar and battery",
      address: "19 Sample Avenue, Glen Iris, Victoria 3147",
      lat: -37.86,
      lng: 145.06,
      stage: "won",
      value: 12345,
      kw: 6.6,
    });
    expect(deal.job.details).toMatchObject({
      systemType: "Solar and battery",
      systemSize: "6.6 kW",
      storeys: "Double",
      phases: "1",
      roofType: "Tin corrugated",
      panel: "REC Solar TwinPeak 2 Series",
      panelQty: "22",
      inverter: "Sungrow SH5K",
      additionalInverter: "2 × Enphase IQ8",
      battery: "Sonnen Eco 8.10",
      batteryStorage: "10.2 kWh",
      nmi: "6305123456",
      meterNo: "M123",
      retailer: "Sample Energy",
      distributor: "United Energy",
      preApprovalRef: "PA-998",
    });
    expect(deal.note).toContain("PYL-0003-7789");
    expect(deal.note).toContain("$12,345.00 inc. GST");
    expect(deal.note).toContain("$2,800");
    expect(deal.signedPdf).toBe("https://files.example.com/signed.pdf?x=1");
  });

  it("leaves out what Pylon doesn't say, and never makes up a name, place or date", () => {
    const bare = { data: { id: "abcd12", attributes: { site_location: [0, 51.5], customer_details: {} } } };
    const deal = dealFromPylon(bare, {}, "installed")!;
    expect(deal.customer.firstName).toBe("Pylon customer");
    expect(deal.job).toMatchObject({ lat: null, lng: null, value: null, kw: null, installDate: null, stage: "installed" });
    expect(deal.job.details).toEqual({});
    expect(deal.signedPdf).toBeNull();
    expect(dealFromPylon({}, {}, "won")).toBeNull();
  });

  it("names the PDF and says how far along a run is", () => {
    expect(pdfName({ reference: "PYL-0003-7789", customer: { firstName: "Jill", lastName: "Example" } } as never, true)).toBe(
      "Signed proposal (Pylon PYL-0003-7789) Jill Example.pdf",
    );
    expect(progressWords({ done: 142, total: 180, already: 3, failed: 0 })).toBe("142 of 180 sold jobs in · 3 already here");
  });
});
