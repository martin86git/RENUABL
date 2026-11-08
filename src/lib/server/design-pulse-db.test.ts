/**
 * Runs against a real Postgres when TEST_DATABASE_URL is set (skipped otherwise; `npm run test:db` sets it): wave 5's
 * deal extras. That an email's pixel puts its opens against that email (two within a minute as one, an unknown token
 * changing nothing); that a deal's pulse warms when its customer writes; that files kept on a deal are read and taken
 * off only by those who may see the deal; and that nothing reaches another business.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ALL_PERMISSIONS, BUSINESS_TERMS_VERSION } from "@/lib/domain/design/account";
import { cleanCustomerInput, cleanJobInput } from "@/lib/domain/design/crm";

const url = process.env.TEST_DATABASE_URL;
const OWNER = "owner@alpha-pulse.test";
const SAM = "sam@alpha-pulse.test";
const OTHER = "owner@beta-pulse.test";

describe.skipIf(!url)("deal pulses, email opens and attachments (database)", () => {
  let db: typeof import("./db");
  let pulse: typeof import("./design-pulse-repo");
  let a: string;
  let b: string;
  let jobId: string;
  let customerId: string;
  const all = { email: OWNER, all: true };
  const samOnly = { email: SAM, all: false };

  beforeAll(async () => {
    process.env.DATABASE_URL = url;
    db = await import("./db");
    await db.resetDbForTests();
    const repo = await import("./design-repo");
    const crm = await import("./design-crm-repo");
    pulse = await import("./design-pulse-repo");
    await db.query(`delete from businesses where created_by in ($1,$2)`, [OWNER, OTHER]);
    a = (await repo.createBusiness(OWNER, "Alpha Solar", BUSINESS_TERMS_VERSION)).businessId;
    b = (await repo.createBusiness(OTHER, "Beta Electrical", BUSINESS_TERMS_VERSION)).businessId;
    expect(await repo.addMember(a, SAM, OWNER)).toBe("added");
    expect(await repo.setPermissions(a, SAM, { ...ALL_PERMISSIONS, allDeals: false })).toBe(true);
    const customer = cleanCustomerInput({ name: "Casey Pulse", address: "1 Sample Street, Exampleton VIC 3000" });
    const job = cleanJobInput({ address: "1 Sample Street, Exampleton VIC 3000" });
    if (!customer.ok || !job.ok) throw new Error("unexpected");
    const made = await crm.createCustomer(a, customer.value, job.value, OWNER);
    if (made === "full" || !made.job) throw new Error("unexpected");
    jobId = made.job.id;
    customerId = made.customer.id;
  });
  afterAll(async () => {
    await db.query(`delete from businesses where created_by in ($1,$2)`, [OWNER, OTHER]);
  });

  it("puts a pixel's opens against its email", async () => {
    const token = pulse.newOpenToken();
    await pulse.recordSent(a, token, jobId, "act_1");
    await pulse.recordOpen(token, new Date("2026-11-02T00:00:00Z"));
    await pulse.recordOpen(token, new Date("2026-11-02T00:00:20Z"));
    await pulse.recordOpen(token, new Date("2026-11-02T00:05:00Z"));
    await pulse.recordOpen("f".repeat(32));
    // Loaded by someone signed in to the business that sent it: not the customer, not counted. Another business's is.
    await pulse.recordOpen(token, new Date("2026-11-02T00:09:00Z"), a);
    expect(await pulse.opensForJob(a, jobId, all)).toEqual({ act_1: ["2026-11-02T00:00:00.000Z", "2026-11-02T00:05:00.000Z"] });
    expect(await pulse.openCountsForJob(a, jobId)).toEqual({ act_1: 2 });
    expect(await pulse.opensForJob(a, jobId, samOnly)).toBeNull();
    expect(await pulse.opensForJob(b, jobId, all)).toBeNull();
  });

  it("warms a deal whose customer writes, and counts an opened email", async () => {
    await db.query(`insert into design_messages (id, business_id, job_id, customer_id, from_customer, text) values ($1,$2,$3,$4,true,$5)`, [
      "msg_pulse_1",
      a,
      jobId,
      customerId,
      "Happy to proceed, when can you start?",
    ]);
    const p = (await pulse.dealPulses(a, all))[jobId];
    expect(p.heat.heat).toBe("hot");
    expect(p.heat.reasons.map((r) => r.text)).toEqual(expect.arrayContaining(["Wrote to us today", "Opened an email from us"]));
    expect((await pulse.dealPulses(a, samOnly))[jobId]).toBeUndefined();
    expect((await pulse.dealPulses(b, all))[jobId]).toBeUndefined();
  });

  it("keeps files on a deal for those who may see it", async () => {
    const files = await pulse.addDealFiles(a, jobId, [new File(["NMI"], "notes.txt", { type: "text/plain" })], OWNER, all);
    const id = files?.[0]?.id ?? "";
    expect((await pulse.dealFile(a, jobId, id, all))?.name).toBe("notes.txt");
    expect(await pulse.dealFile(a, jobId, id, samOnly)).toBeNull();
    expect(await pulse.dealFile(b, jobId, id, all)).toBeNull();
    await expect(
      pulse.addDealFiles(a, jobId, [new File(["MZ"], "run.exe", { type: "application/x-msdownload" })], OWNER, all),
    ).rejects.toThrow();
    expect(await pulse.removeDealFile(b, jobId, id, all)).toBe(false);
    expect(await pulse.removeDealFile(a, jobId, id, all)).toBe(true);
  });
});
