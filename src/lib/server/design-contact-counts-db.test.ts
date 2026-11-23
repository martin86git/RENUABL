/**
 * Runs against a real Postgres when TEST_DATABASE_URL is set (skipped otherwise; `npm run test:db` sets it): Sol's
 * contact counts (design-contact-counts.ts). People brought in by a sheet import, one added by hand after it, and one
 * installed: the totals, the import and who came after it.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { BUSINESS_TERMS_VERSION } from "@/lib/domain/design/account";
import type { ImportRow } from "@/lib/domain/design/crm-import";

const url = process.env.TEST_DATABASE_URL;
const A = "owner@alpha-contacts.test";

const row = (first: string, email: string, stage: ImportRow["stage"]): ImportRow => ({
  firstName: first,
  lastName: "Test",
  email,
  phone: "",
  address: "",
  title: "Solar",
  stage,
  stageWords: stage,
  value: null,
  kw: null,
  day: "",
  owner: "",
  source: "",
  notes: "",
});

describe.skipIf(!url)("Sol's contact counts (database)", () => {
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

  it("counts everyone, what an import brought and who came after it", async () => {
    const imp = await import("./design-crm-import");
    const crm = await import("./design-crm-repo");
    const { contactCounts } = await import("./design-contact-counts");
    await imp.bringInSheetRows(a, [row("Ann", "ann@x.test", "installed"), row("Bob", "bob@x.test", "lead")], "deals", "old.csv", A);
    await new Promise((r) => setTimeout(r, 20));
    await crm.createCustomer(
      a,
      { name: "Cat Later", email: "cat@x.test", phone: "", address: "", source: "Lead inbox", notes: "" } as never,
      null,
      A,
    );
    const c = await contactCounts(a, null);
    expect(c.people).toBe(3);
    expect(c.customers).toBe(1);
    expect(c.imports).toHaveLength(1);
    expect(c.imports[0]).toMatchObject({ source: "sheet", brought: 2 });
    expect(c.sinceImport[0]).toMatchObject({ source: "sheet", people: 1 });
    const since = await contactCounts(a, "2000-01-01");
    expect(since.since).toMatchObject({ people: 3, customers: 1 });
  });
});
