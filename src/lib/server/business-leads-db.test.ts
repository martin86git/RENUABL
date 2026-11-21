/**
 * Runs against a real Postgres when TEST_DATABASE_URL is set (skipped otherwise; `npm run test:db` sets it): RENUABL
 * Business's own sales pipeline (business-leads-repo.ts). A demo request comes in at New, staff move it and note it,
 * and the marketplace waiting list stays out.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const url = process.env.TEST_DATABASE_URL;
const MARK = "@pipeline-leads.test";

describe.skipIf(!url)("RENUABL Business's sales pipeline (database)", () => {
  let db: typeof import("./db");

  beforeAll(async () => {
    process.env.DATABASE_URL = url;
    db = await import("./db");
    await db.resetDbForTests();
    await db.query(`delete from design_leads where email like $1`, [`%${MARK}`]);
  });
  afterAll(async () => {
    await db.query(`delete from design_leads where email like $1`, [`%${MARK}`]);
  });

  it("brings a demo request in at New, moves it, notes it, and leaves the waiting list out", async () => {
    const billing = await import("./design-billing-repo");
    const repo = await import("./business-leads-repo");
    await billing.recordLead("demo-request", { email: `sam${MARK}`, name: "Sam Lee", business: "Bright Sparks", note: "The designer" });
    await billing.recordLead("marketplace", { email: `wait${MARK}` });

    const mine = (await repo.listBusinessLeads()).filter((l) => l.email.endsWith(MARK));
    expect(mine).toHaveLength(1);
    const sam = mine[0];
    expect(sam).toMatchObject({ kind: "demo-request", stage: "new", name: "Sam Lee", note: "The designer", staffNote: null });

    expect(await repo.moveBusinessLead(sam.id, "booked", "Staff@renuabl.test")).toBe(true);
    expect(await repo.noteBusinessLead(sam.id, "Tuesday 10am")).toBe(true);
    const moved = (await repo.listBusinessLeads()).find((l) => l.id === sam.id);
    expect(moved).toMatchObject({ stage: "booked", staffNote: "Tuesday 10am", movedBy: "staff@renuabl.test" });
    expect(moved?.stageAt).toBeTruthy();

    expect(await repo.noteBusinessLead(sam.id, "")).toBe(true);
    expect((await repo.listBusinessLeads()).find((l) => l.id === sam.id)?.staffNote).toBeNull();

    const waiting = (await db.query<{ id: string }>(`select id from design_leads where email = $1`, [`wait${MARK}`]))[0];
    expect(await repo.moveBusinessLead(waiting.id, "won", "staff@renuabl.test")).toBe(false);
    expect(await repo.moveBusinessLead("lead_nothere", "won", "staff@renuabl.test")).toBe(false);
  });
});
