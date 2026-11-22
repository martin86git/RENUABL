import { describe, expect, it } from "vitest";
import {
  csvStage,
  fillFromPylon,
  dealFromCsv,
  readCsv,
  readPylonExport,
  soldDay,
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

const EXPORT = [
  "\uFEFFproject_id,project_reference_number,created_at,owner_name,owner_email,customer_name,customer_phone,customer_email,address_line_1,address_line_2,locality,postal_code,region,country,is_sold,sold_at,is_pro,in_app_link,layout_size_kwp,quoted_price_total,proposal_link,stc_quantity,stc_value,lgc_quantity,lgc_value",
  'cs6X7F9,,"2020-05-26 20:33:14 +10:00",Sam,sam@sample.test,,,,"4 Sample Street",,Cranbourne,3977,Victoria,Australia,false,,false,https://app.getpylon.com/library/cs6X7F9,,,,,,,',
  'tex7GYi8,2130064,"2020-08-21 16:47:16 +10:00","Sam Seller",SAM@sample.test,"Wendy Example","0000 000 000",Wendy@Example.com,"178 Sample Drive",,Rosebud,3939,Victoria,Australia,true,"2020-09-04 23:51:54 +00:00",false,x,10.5,10170.98,https://app.getpylon.com/proposals/q2bIjAHTBI,136,4760.00,,0.00',
  'kk30wsV0,"113-4444-333","2026-11-01 11:20:30 +11:00","Sam Seller",sam@sample.test,"Jamie","0400 000 001",,"544 Sample Road",,Mitcham,3132,Victoria,Australia,true,"2026-11-10 16:30:20 +11:00",false,x,6.6,"8,011.29",https://evil.example/p,,,,',
].join("\r\n");

describe("Pylon's CSV export", () => {
  it("reads quoted cells, doubled quotes and line breaks inside quotes", () => {
    expect(readCsv('a,"b, c","d ""e""\nf"\r\n1,2,3\n')).toEqual([
      ["a", "b, c", 'd "e"\nf'],
      ["1", "2", "3"],
    ]);
  });

  it("keeps only the sold projects, oldest first, and says what isn't Pylon's", () => {
    const read = readPylonExport(EXPORT);
    if ("problem" in read) throw new Error(read.problem);
    expect(read.all).toBe(3);
    expect(read.sold.map((r) => r.id)).toEqual(["tex7GYi8", "kk30wsV0"]);
    expect(read.sold[0]).toMatchObject({ soldOn: "2020-09-05", kw: 10.5, price: 10170.98, stcValue: 4760, ownerEmail: "sam@sample.test" });
    expect(read.sold[1]).toMatchObject({ price: 8011.29, proposalLink: "" });
    expect(readPylonExport("name,email\nJo,jo@x.test")).toEqual({ problem: expect.stringContaining("Pylon") });
  });

  it("reads Pylon's sold time as the day in Melbourne", () => {
    expect(soldDay("2020-09-04 10:51:54 +10:00")).toBe("2020-09-04");
    expect(soldDay("2020-09-04 23:51:54 +00:00")).toBe("2020-09-05");
    expect(soldDay("not a date")).toBe("");
  });

  it("brings recent sales in as Won and older ones as Installed", () => {
    expect(csvStage("2026-11-10", "2026-11-20")).toBe("won");
    expect(csvStage("2026-08-01", "2026-11-20")).toBe("installed");
    expect(csvStage("2026-08-01", "2026-11-20", 52)).toBe("won");
    expect(csvStage("", "2026-11-20")).toBe("won");
  });

  it("makes a customer and a deal from a row, leaving out a placeholder phone and never making up a name", () => {
    const read = readPylonExport(EXPORT);
    if ("problem" in read) throw new Error(read.problem);
    const deal = dealFromCsv(read.sold[0], "installed");
    expect(deal.customer).toMatchObject({ firstName: "Wendy", lastName: "Example", email: "wendy@example.com", phone: "" });
    expect(deal.job).toMatchObject({
      stage: "installed",
      value: 10170.98,
      kw: 10.5,
      lat: null,
      address: "178 Sample Drive, Rosebud, Victoria 3939",
    });
    expect(deal.note).toContain("Sold in Pylon on 5 September 2020 by Sam Seller");
    expect(deal.note).toContain("https://app.getpylon.com/proposals/q2bIjAHTBI");
    const one = dealFromCsv({ ...read.sold[1], name: "" }, "won");
    expect(one.customer).toMatchObject({ firstName: "Pylon customer", lastName: "113-4444-333", phone: "0400 000 001" });
    expect(dealFromCsv({ ...read.sold[1], name: "J" }, "won").customer).toMatchObject({
      firstName: "Pylon customer",
      lastName: "J 113-4444-333",
    });
  });
});

describe("filling in a deal from Pylon", () => {
  const deal = {
    job: {
      title: "Solar and battery",
      address: "1 Sample Street, Testville VIC 3000",
      lat: -37.9,
      lng: 145.1,
      stage: "installed" as const,
      value: null,
      installDate: null,
      details: {
        systemType: "Solar and battery",
        systemSize: "6.6 kW",
        battery: "Sigenergy SigenStor",
        batteryStorage: "16 kWh",
        nmi: "6305123456",
      },
      kw: 6.6,
    },
  };

  it("adds the battery and replaces what the export set, never what a person typed", () => {
    const got = fillFromPylon(
      { title: "Solar", details: { systemType: "Solar", systemSize: "6.6 kW", nmi: "6305999999" }, address: "", lat: null },
      deal,
    );
    expect(got.details.systemType).toBe("Solar and battery");
    expect(got.details.battery).toBe("Sigenergy SigenStor");
    expect(got.details.nmi).toBe("6305999999");
    expect(got.title).toBe("Solar and battery");
    expect(got.place).toEqual({ address: deal.job.address, lat: -37.9, lng: 145.1 });
    expect(got.filled).toEqual(["systemType", "battery", "batteryStorage", "place"]);
  });

  it("leaves a deal already on the map, and a title a person changed, alone", () => {
    const got = fillFromPylon({ title: "Battery upgrade", details: {}, address: "x", lat: -37 }, deal);
    expect(got.title).toBe("Battery upgrade");
    expect(got.place).toBeNull();
  });
});
