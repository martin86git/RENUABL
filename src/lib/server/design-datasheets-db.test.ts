/**
 * Runs against a real Postgres when TEST_DATABASE_URL is set (skipped
 * otherwise; `npm run test:db` sets it): a business's checked datasheets. That
 * figures are kept by product code, replaced when saved again, read back as
 * the designer uses them, taken away, and shared with every other business
 * without saying whose they are.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { BUSINESS_TERMS_VERSION } from "@/lib/domain/design/account";
import { checkInverter, checkPanel } from "@/lib/domain/design/datasheets";

const url = process.env.TEST_DATABASE_URL;
const A = "owner@alpha-sheets.test";
const B = "owner@beta-sheets.test";

describe.skipIf(!url)("product datasheets (database)", () => {
  let db: typeof import("./db");
  let sheets: typeof import("./design-datasheets-repo");
  let a: string;
  let b: string;

  beforeAll(async () => {
    process.env.DATABASE_URL = url;
    db = await import("./db");
    await db.resetDbForTests();
    const repo = await import("./design-repo");
    sheets = await import("./design-datasheets-repo");
    await db.query(`delete from businesses where created_by in ($1,$2)`, [A, B]);
    a = (await repo.createBusiness(A, "Alpha Solar", BUSINESS_TERMS_VERSION)).businessId;
    b = (await repo.createBusiness(B, "Beta Electrical", BUSINESS_TERMS_VERSION)).businessId;
  });
  afterAll(async () => {
    await db.query(`delete from businesses where created_by in ($1,$2)`, [A, B]);
  });

  it("keeps a product's figures by its code, replaces them, and takes them away", async () => {
    const panel = checkPanel(
      { voc: "36.4", vmp: "31.1", isc: "15.9", imp: "15.3", vocPercent: "-0.24", iscPercent: "0.046", pmaxPercent: "-0.26" },
      "first",
    );
    const inverter = checkInverter(
      {
        maxVoltage: "600",
        mppMin: "40",
        mppMax: "560",
        startVoltage: "40",
        mppts: [{ maxCurrent: "16", maxShortCircuit: "20", strings: "1" }],
      },
      "inv",
    );
    if (!panel.ok || !inverter.ok) throw new Error("unexpected");
    await sheets.saveSheet(a, { kind: "panel", sku: "NEW-475", model: "New 475", fileName: "new.pdf", figures: panel.value }, A);
    await sheets.saveSheet(
      a,
      { kind: "panel", sku: "NEW-475", model: "New 475", fileName: "new.pdf", figures: { ...panel.value, basis: "second" } },
      A,
    );
    await sheets.saveSheet(a, { kind: "inverter", sku: "INV-6", model: "Inv 6", fileName: "inv.pdf", figures: inverter.value }, A);
    const mine = await sheets.businessDatasheets(a);
    expect(mine.panels["NEW-475"].basis).toBe("second");
    expect(mine.inverters["INV-6"].mppts).toHaveLength(1);
    expect((await sheets.listSheets(a)).map((s) => s.sku)).toEqual(["INV-6", "NEW-475"]);
    expect(await sheets.deleteSheet(a, "inverter", "INV-6")).toBe(true);
    expect(Object.keys((await sheets.businessDatasheets(a)).inverters)).toEqual([]);
  });

  it("shares a sheet with every business, never saying whose, and never lets another take it away", async () => {
    const theirs = await sheets.listSheets(b);
    expect(theirs.map((s) => [s.sku, s.shared, s.checkedBy])).toEqual([["NEW-475", true, "another business on RENUABL"]]);
    expect(JSON.stringify(theirs)).not.toContain("alpha");
    expect(JSON.stringify(theirs)).not.toContain("owner");
    expect((await sheets.businessDatasheets(b)).panels["NEW-475"].voc).toBe(36.4);
    // Checked where it came from, and still to check here until someone at this business confirms it.
    expect(theirs[0]!.unchecked && theirs[0]!.checkedElsewhere).toBe(true);
    expect((await sheets.businessDatasheets(b)).panels["NEW-475"].unchecked).toBe("/design/settings/datasheets");
    expect((await sheets.businessDatasheets(a)).panels["NEW-475"].unchecked).toBeUndefined();
    expect(await sheets.deleteSheet(b, "panel", "NEW-475")).toBe(false);
    expect(Object.keys((await sheets.businessDatasheets(a)).panels)).toEqual(["NEW-475"]);
    // The business that added it sees its own, not a shared copy.
    expect((await sheets.listSheets(a)).some((s) => s.shared)).toBe(false);
  });

  it("puts a business's own sheet ahead of a shared one, however the code is written", async () => {
    const panel = checkPanel(
      { voc: "40", vmp: "33", isc: "14", imp: "13.5", vocPercent: "-0.25", iscPercent: "0.05", pmaxPercent: "-0.29" },
      "beta's own",
    );
    if (!panel.ok) throw new Error("unexpected");
    await sheets.saveSheet(b, { kind: "panel", sku: "new 475", model: "", fileName: "", figures: panel.value }, B);
    const mine = await sheets.listSheets(b);
    expect(mine.map((s) => [s.sku, Boolean(s.shared)])).toEqual([["new 475", false]]);
    expect(await sheets.deleteSheet(b, "panel", "new 475")).toBe(true);
  });

  it("makes a shared sheet the business's own once someone there has checked it", async () => {
    expect(await sheets.adoptSharedSheet(b, "panel", "NEW-475", "Sam@beta-sheets.test")).toBe(true);
    const own = (await sheets.listSheets(b))[0]!;
    expect(own.shared).toBeUndefined();
    expect(own.checkedBy).toBe("sam@beta-sheets.test");
    expect(own.unchecked).toBe(false);
    expect(own.figures.basis).toMatch(/read and checked by sam on /);
    expect(await sheets.adoptSharedSheet(b, "panel", "NEW-475", B)).toBe(false);
    expect(await sheets.adoptSharedSheet(b, "inverter", "NOT-THERE", B)).toBe(false);
    expect(await sheets.deleteSheet(b, "panel", "NEW-475")).toBe(true);
  });

  it("shares nothing from a made-up business, and marks a found sheet to check for everyone", async () => {
    const repo = await import("./design-repo");
    const demo = (await repo.createBusiness("demo-x@demo.renuabl.example", "A demo", BUSINESS_TERMS_VERSION)).businessId;
    const panel = checkPanel(
      { voc: "50", vmp: "42", isc: "13", imp: "12.5", vocPercent: "-0.25", iscPercent: "0.05", pmaxPercent: "-0.29" },
      "demo",
    );
    if (!panel.ok) throw new Error("unexpected");
    await sheets.saveSheet(
      demo,
      { kind: "panel", sku: "DEMO-500", model: "", fileName: "", figures: panel.value },
      "demo-x@demo.renuabl.example",
    );
    expect((await sheets.listSheets(b)).map((s) => s.sku)).toEqual(["NEW-475"]);
    await db.query(`delete from businesses where id = $1`, [demo]);
    expect(
      await sheets.saveFoundSheet(
        a,
        { kind: "panel", sku: "FOUND-440", model: "Found 440", fileName: "f.pdf", figures: panel.value, url: "https://example.com/f.pdf" },
        null,
      ),
    ).toBe(true);
    const found = (await sheets.listSheets(b)).find((s) => s.sku === "FOUND-440")!;
    expect(found.shared && found.unchecked).toBe(true);
    expect(found.checkedElsewhere).toBe(false);
    expect((await sheets.businessDatasheets(b)).panels["FOUND-440"].unchecked).toBe("https://example.com/f.pdf");
    expect(found.figures.basis).toMatch(/found online for another business on RENUABL/);
  });

  it("keeps a battery's sheet as a file alone, matches codes however written, and fills a missing file once found", async () => {
    const pdf = Buffer.from("%PDF-1.4 sheet");
    await sheets.saveProductFile(
      a,
      { kind: "battery", sku: "SIGEN-BAT-8.0", model: "SigenStor 8", fileName: "sigen.pdf" },
      { bytes: pdf, type: "application/pdf" },
      A,
    );
    // Batteries never show among the figures the designer reads.
    expect((await sheets.listSheets(a)).some((x) => x.kind === ("battery" as never))).toBe(false);
    expect((await sheets.listProductFiles(a)).map((f) => f.sku)).toContain("SIGEN-BAT-8.0");
    const onHand = await sheets.sheetsOnHand(a, [{ kind: "battery", sku: "sigen bat 8.0" }]);
    expect([...onHand.keys()]).toEqual(["battery:SIGENBAT8.0"]);
    expect((await sheets.sheetFileByKey(a, "battery", "sigen_bat_8.0"))?.fileName).toBe("sigen.pdf");
    // Shared with another business, to check there.
    expect((await sheets.sheetsOnHand(b, [{ kind: "battery", sku: "SIGEN-BAT-8.0" }])).get("battery:SIGENBAT8.0")).toEqual({
      unchecked: true,
    });
    expect((await sheets.listProductFiles(b)).find((f) => f.sku === "SIGEN-BAT-8.0")?.shared).toBe(true);

    // An inverter with figures and no file: a sheet found online fills the file without counting as new figures.
    const inverter = checkInverter(
      {
        maxVoltage: "600",
        mppMin: "40",
        mppMax: "560",
        startVoltage: "40",
        mppts: [{ maxCurrent: "16", maxShortCircuit: "20", strings: "1" }],
      },
      "inv",
    );
    if (!inverter.ok) throw new Error("unexpected");
    await sheets.saveSheet(a, { kind: "inverter", sku: "FILL-5", model: "Fill 5", fileName: "", figures: inverter.value }, A);
    const found = {
      kind: "inverter" as const,
      sku: "FILL-5",
      model: "Fill 5",
      fileName: "fill.pdf",
      figures: inverter.value,
      url: "https://x.test/f.pdf",
    };
    expect(await sheets.saveFoundSheet(a, found, { bytes: pdf, type: "application/pdf" })).toBe(false);
    expect((await sheets.sheetFile(a, "inverter", "FILL-5"))?.bytes.length).toBe(pdf.length);
    expect(await sheets.saveFoundSheet(a, { ...found, sku: "NEW-INV" }, null)).toBe(true);
  });
});
