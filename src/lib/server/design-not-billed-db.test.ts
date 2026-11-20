/**
 * Runs against a real Postgres when TEST_DATABASE_URL is set (skipped otherwise; `npm run test:db` sets it): a business
 * RENUABL doesn't bill (design-not-billed.ts). That staff set it and take it off, that the admin list says so, and that
 * a design job is never refused for it though its balance is empty.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { BUSINESS_TERMS_VERSION } from "@/lib/domain/design/account";

const url = process.env.TEST_DATABASE_URL;
const A = "owner@alpha-notbilled.test";

describe.skipIf(!url)("a business RENUABL doesn't bill (database)", () => {
  let db: typeof import("./db");
  let a: string;

  beforeAll(async () => {
    process.env.DATABASE_URL = url;
    db = await import("./db");
    await db.resetDbForTests();
    const repo = await import("./design-repo");
    await db.query(`delete from businesses where created_by = $1`, [A]);
    a = (await repo.createBusiness(A, "Alpha Solar", BUSINESS_TERMS_VERSION)).businessId;
  });
  afterAll(async () => {
    await db.query(`delete from businesses where created_by = $1`, [A]);
  });

  it("is set and taken off by staff, and shows on the admin list", async () => {
    const nb = await import("./design-not-billed");
    const admin = await import("./design-admin-repo");
    expect(await nb.isNotBilled(a)).toBe(false);
    expect(await nb.setNotBilled(a, true, "staff@renuabl.test")).toBe(true);
    expect(await nb.isNotBilled(a)).toBe(true);
    const row = (await admin.listDesignBusinesses()).find((b) => b.id === a);
    expect(row).toMatchObject({ notBilled: true, owner: A });
    expect(await nb.setNotBilled(a, false, "staff@renuabl.test")).toBe(true);
    expect(await nb.isNotBilled(a)).toBe(false);
    expect(await nb.setNotBilled("biz_nothere", true, "staff@renuabl.test")).toBe(false);
  });

  it("never refuses a design job, though nothing has been bought", async () => {
    const nb = await import("./design-not-billed");
    const billing = await import("./design-billing-repo");
    await nb.setNotBilled(a, true, "staff@renuabl.test");
    expect(await billing.canStartRoof(a, true)).toBe(true);
    expect(await billing.canAddBattery(a, "roof_x")).toBe(true);
  });
});
