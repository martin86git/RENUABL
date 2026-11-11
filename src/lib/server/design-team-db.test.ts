/**
 * Runs against a real Postgres when TEST_DATABASE_URL is set (skipped
 * otherwise; `npm run test:db` sets it): deal owners, who sees which deals,
 * and @mentions. That a deal belongs to whoever made it and can be given to
 * someone else or no one; that a member who doesn't see every deal sees only
 * their own, no one's, and those they are mentioned on; that a mention lands
 * in the member's own notifications (never the writer's) and is read when they
 * open the deal; and that nothing reaches another business.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ALL_PERMISSIONS, BUSINESS_TERMS_VERSION } from "@/lib/domain/design/account";
import { cleanCustomerInput, cleanJobInput } from "@/lib/domain/design/crm";

const url = process.env.TEST_DATABASE_URL;
const OWNER = "owner@alpha-team.test";
const SAM = "sam.jones@alpha-team.test";
const OTHER = "owner@beta-team.test";

describe.skipIf(!url)("deal owners and mentions (database)", () => {
  let db: typeof import("./db");
  let crm: typeof import("./design-crm-repo");
  let notes: typeof import("./design-notifications-repo");
  let a: string;
  let b: string;
  let owners: string;
  let nobodys: string;
  const sam = { email: SAM, all: false };

  async function deal(name: string): Promise<{ jobId: string; customerId: string }> {
    const customer = cleanCustomerInput({ name, address: "1 Sample Street, Exampleton VIC 3000" });
    // Past the lead stage, so it stays with whoever made it (a lead the owner adds goes to the one salesperson, below).
    const job = cleanJobInput({ address: "1 Sample Street, Exampleton VIC 3000", stage: "designed" });
    if (!customer.ok || !job.ok) throw new Error("unexpected");
    const made = await crm.createCustomer(a, customer.value, job.value, OWNER);
    if (made === "full" || !made.job) throw new Error("unexpected");
    return { jobId: made.job.id, customerId: made.customer.id };
  }

  beforeAll(async () => {
    process.env.DATABASE_URL = url;
    db = await import("./db");
    await db.resetDbForTests();
    const repo = await import("./design-repo");
    crm = await import("./design-crm-repo");
    notes = await import("./design-notifications-repo");
    await db.query(`delete from businesses where created_by in ($1,$2)`, [OWNER, OTHER]);
    a = (await repo.createBusiness(OWNER, "Alpha Solar", BUSINESS_TERMS_VERSION)).businessId;
    b = (await repo.createBusiness(OTHER, "Beta Electrical", BUSINESS_TERMS_VERSION)).businessId;
    expect(await repo.addMember(a, SAM, OWNER)).toBe("added");
    expect(await repo.setPermissions(a, SAM, { ...ALL_PERMISSIONS, allDeals: false })).toBe(true);
    owners = (await deal("Alex Owned")).jobId;
    nobodys = (await deal("Bea Unowned")).jobId;
  });
  afterAll(async () => {
    await db.query(`delete from businesses where created_by in ($1,$2)`, [OWNER, OTHER]);
  });

  it("gives a lead the owner adds to the business's one salesperson", async () => {
    const customer = cleanCustomerInput({ name: "Cleo Lead", address: "2 Sample Street, Exampleton VIC 3000" });
    const job = cleanJobInput({ address: "2 Sample Street, Exampleton VIC 3000" });
    if (!customer.ok || !job.ok) throw new Error("unexpected");
    const made = await crm.createCustomer(a, customer.value, job.value, OWNER);
    if (made === "full" || !made.job) throw new Error("unexpected");
    expect(made.job.owner).toBe(SAM);
    await crm.setJobOwner(a, made.job.id, OWNER, OWNER);
  });

  it("gives a deal to whoever made it, and to someone else or no one, on its record", async () => {
    const found = await crm.jobById(a, owners);
    expect(found?.job.owner).toBe(OWNER);
    const given = await crm.setJobOwner(a, nobodys, null, OWNER);
    expect(given?.owner).toBeNull();
    const written = await db.query<{ text: string }>(`select text from design_activity where business_id = $1 and job_id = $2`, [
      a,
      nobodys,
    ]);
    expect(written.map((w) => w.text)).toContain("Deal left with no owner");
  });

  it("shows a member who doesn't see every deal only their own and no one's", async () => {
    // Only the two deals made here (a new business also starts with sample deals, which no one owns).
    const ours = (jobs: { id: string }[]) =>
      jobs
        .map((j) => j.id)
        .filter((id) => id === owners || id === nobodys)
        .sort();
    expect(ours(await crm.listJobs(a))).toEqual([owners, nobodys].sort());
    expect(ours(await crm.listJobs(a, sam))).toEqual([nobodys]);
    expect(await crm.jobById(a, owners, sam)).toBeNull();
    expect(await crm.jobById(a, owners, { email: OWNER, all: false })).not.toBeNull();
  });

  it("notifies the member mentioned (never the writer), lets them see that deal, and reads it when they open it", async () => {
    const told = await notes.notifyMentions(a, {
      jobId: owners,
      customerId: (await crm.jobById(a, owners))!.job.customerId,
      text: "@sam can you ring them? cc @owner",
      by: OWNER,
    });
    expect(told).toEqual([SAM]);
    expect(await notes.unreadNotifications(a, OWNER)).toBe(0);
    expect(await notes.unreadNotifications(a, SAM)).toBe(1);
    const [n] = await notes.listNotifications(a, SAM);
    expect(n).toMatchObject({ jobId: owners, customer: "Alex Owned", by: OWNER, read: false });
    // Mentioned, Sam now sees that deal.
    expect(await crm.jobById(a, owners, sam)).not.toBeNull();
    await notes.markNotificationsRead(a, SAM, { jobId: owners });
    expect(await notes.unreadNotifications(a, SAM)).toBe(0);
  });

  it("never reaches another business", async () => {
    expect(await crm.listJobs(b)).not.toContainEqual(expect.objectContaining({ id: owners }));
    expect(await crm.setJobOwner(b, owners, OTHER, OTHER)).toBeNull();
    expect(await notes.listNotifications(b, SAM)).toEqual([]);
  });
});
