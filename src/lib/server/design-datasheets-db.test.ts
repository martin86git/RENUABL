/**
 * Runs against a real Postgres when TEST_DATABASE_URL is set (skipped
 * otherwise; `npm run test:db` sets it): a business's checked datasheets. That
 * figures are kept by product code, replaced when saved again, read back as
 * the designer uses them, taken away, and never seen by another business.
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

  it("never shows one business's figures to another, nor lets it take them away", async () => {
    expect(await sheets.businessDatasheets(b)).toEqual({ panels: {}, inverters: {} });
    expect(await sheets.deleteSheet(b, "panel", "NEW-475")).toBe(false);
    expect(Object.keys((await sheets.businessDatasheets(a)).panels)).toEqual(["NEW-475"]);
  });
});
