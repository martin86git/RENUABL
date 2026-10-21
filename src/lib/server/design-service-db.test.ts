/**
 * Runs against a real Postgres when TEST_DATABASE_URL is set (skipped
 * otherwise; `npm run test:db` sets it): the service pipeline. That a deal is
 * flagged once at a time, moves through its steps with its history and is
 * written on the deal's record, comes back into the count until resolved, and
 * that one business never reaches another's cases or deals.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { BUSINESS_TERMS_VERSION } from "@/lib/domain/design/account";
import { cleanCustomerInput, cleanJobInput } from "@/lib/domain/design/crm";

const url = process.env.TEST_DATABASE_URL;
const A = "owner@alpha-service.test";
const B = "owner@beta-service.test";

describe.skipIf(!url)("the service pipeline (database)", () => {
  let db: typeof import("./db");
  let svc: typeof import("./design-service-repo");
  let a: string;
  let b: string;
  let jobId: string;

  beforeAll(async () => {
    process.env.DATABASE_URL = url;
    db = await import("./db");
    await db.resetDbForTests();
    const repo = await import("./design-repo");
    const crm = await import("./design-crm-repo");
    svc = await import("./design-service-repo");
    await db.query(`delete from businesses where created_by in ($1,$2)`, [A, B]);
    a = (await repo.createBusiness(A, "Alpha Solar", BUSINESS_TERMS_VERSION)).businessId;
    b = (await repo.createBusiness(B, "Beta Electrical", BUSINESS_TERMS_VERSION)).businessId;
    const customer = cleanCustomerInput({ name: "Alex Example", phone: "0400 000 000", address: "1 Sample Street, Exampleton VIC 3000" });
    const job = cleanJobInput({ address: "1 Sample Street, Exampleton VIC 3000" });
    if (!customer.ok || !job.ok) throw new Error("unexpected");
    const made = await crm.createCustomer(a, customer.value, job.value, A);
    if (made === "full" || !made.job) throw new Error("unexpected");
    jobId = made.job.id;
  });
  afterAll(async () => {
    await db.query(`delete from businesses where created_by in ($1,$2)`, [A, B]);
  });

  it("flags a deal once at a time, with the customer beside it and a count to resolve", async () => {
    expect(await svc.raiseCase(a, jobId, "  ", A)).toEqual({ refused: "Say what the issue is." });
    const raised = await svc.raiseCase(a, jobId, "Inverter showing an earth fault", A);
    if (typeof raised === "string" || "refused" in raised) throw new Error("unexpected");
    expect(raised.state).toBe("open");
    expect(await svc.raiseCase(a, jobId, "Again", A)).toEqual({ refused: "This deal already has a service case open." });
    const [line] = await svc.listCases(a);
    expect(line).toMatchObject({ customer: "Alex Example", phone: "0400 000 000", issue: "Inverter showing an earth fault" });
    expect(await svc.casesToResolve(a)).toBe(1);
  });

  it("moves through its steps, keeps its history, and writes each on the deal", async () => {
    const [c] = await svc.listCases(a);
    const inHand = await svc.updateCase(a, c.id, { state: "in-hand", text: "Tech booked Thursday" }, A);
    if (typeof inHand === "string" || "refused" in inHand) throw new Error("unexpected");
    expect(inHand.updates).toHaveLength(1);
    expect(await svc.updateCase(a, c.id, { state: "open" }, A)).toEqual({ refused: "That isn't a step this case can take now." });
    const done = await svc.updateCase(a, c.id, { state: "resolved" }, A);
    if (typeof done === "string" || "refused" in done) throw new Error("unexpected");
    expect(done.resolvedAt).not.toBeNull();
    expect(await svc.casesToResolve(a)).toBe(0);
    const written = await db.query<{ text: string }>(
      `select text from design_activity where business_id = $1 and job_id = $2 and kind = 'service' order by at`,
      [a, jobId],
    );
    expect(written.map((w) => w.text.split("\n")[0])).toEqual(["Flagged for service", "Service case in hand", "Service case resolved"]);
    // Resolved, the deal can be flagged again.
    const again = await svc.raiseCase(a, jobId, "Panel cracked", A);
    expect(typeof again === "object" && !("refused" in again)).toBe(true);
  });

  it("never lets another business see or touch them", async () => {
    expect(await svc.listCases(b)).toEqual([]);
    expect(await svc.raiseCase(b, jobId, "Not yours", B)).toBe("missing");
    const [c] = await svc.listCases(a);
    expect(await svc.updateCase(b, c.id, { text: "Not yours" }, B)).toBe("missing");
  });
});
