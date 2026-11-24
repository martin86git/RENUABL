/**
 * Runs against a real Postgres when TEST_DATABASE_URL is set (`npm run test:db`): deal owners not invited yet. That
 * one can own deals without being a member (no seat, no sign-in), that their email is free to join another business,
 * that inviting them makes them a member who keeps their deals, and that removing them leaves their deals with no owner.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { BUSINESS_TERMS_VERSION } from "@/lib/domain/design/account";
import { cleanCustomerInput, cleanJobInput } from "@/lib/domain/design/crm";

const url = process.env.TEST_DATABASE_URL;
const OWNER = "owner@alpha-owners.test";
const OTHER = "owner@beta-owners.test";
const JO = "jo.past@alpha-owners.test";
const KIM = "kim.past@alpha-owners.test";

describe.skipIf(!url)("deal owners not invited yet (database)", () => {
  let db: typeof import("./db");
  let repo: typeof import("./design-repo");
  let crm: typeof import("./design-crm-repo");
  let billing: typeof import("./design-billing-repo");
  let a: string;
  let b: string;

  async function deal(name: string): Promise<string> {
    const customer = cleanCustomerInput({ name, address: "1 Sample Street, Exampleton VIC 3000" });
    const job = cleanJobInput({ address: "1 Sample Street, Exampleton VIC 3000", stage: "won" });
    if (!customer.ok || !job.ok) throw new Error("unexpected");
    const made = await crm.createCustomer(a, customer.value, job.value, OWNER);
    if (made === "full" || !made.job) throw new Error("unexpected");
    return made.job.id;
  }

  beforeAll(async () => {
    process.env.DATABASE_URL = url;
    db = await import("./db");
    await db.resetDbForTests();
    repo = await import("./design-repo");
    crm = await import("./design-crm-repo");
    billing = await import("./design-billing-repo");
    await db.query(`delete from business_members where email in ($1,$2)`, [JO, KIM]);
    await db.query(`delete from businesses where created_by in ($1,$2)`, [OWNER, OTHER]);
    a = (await repo.createBusiness(OWNER, "Alpha Owners", BUSINESS_TERMS_VERSION)).businessId;
    b = (await repo.createBusiness(OTHER, "Beta Owners", BUSINESS_TERMS_VERSION)).businessId;
  });
  afterAll(async () => {
    await db.query(`delete from business_members where email in ($1,$2)`, [JO, KIM]);
    await db.query(`delete from businesses where created_by in ($1,$2)`, [OWNER, OTHER]);
  });

  it("owns deals without being a member or a paid user", async () => {
    expect(await repo.addOwnerOnly(a, JO, "Jo Past", OWNER)).toBe("added");
    expect(await repo.mayOwnDeals(a, JO)).toBe(true);
    expect(await repo.mayOwnDeals(b, JO)).toBe(false);
    expect(await repo.memberByEmail(JO)).toBeNull();
    expect(await billing.memberCount(a)).toBe(1);
    const id = await deal("Pat Past");
    await crm.setJobOwner(a, id, JO, OWNER);
    expect((await repo.listOwnerOnly(a))[0]).toEqual({ email: JO, name: "Jo Past", deals: 1 });
    expect(await repo.addOwnerOnly(a, OWNER, "Owner", OWNER)).toBe("member");
  });

  it("invites them, and they keep their deals", async () => {
    expect(await repo.inviteOwnerOnly(a, JO, OWNER)).toBe("added");
    expect((await repo.memberByEmail(JO))?.businessId).toBe(a);
    expect(await repo.listOwnerOnly(a)).toEqual([]);
    const mine = (await crm.listJobs(a)).filter((j) => j.owner === JO);
    expect(mine).toHaveLength(1);
    expect(await repo.inviteOwnerOnly(a, KIM, OWNER)).toBe("missing");
  });

  it("leaves their deals with no owner when removed, and their email free elsewhere", async () => {
    expect(await repo.addOwnerOnly(a, KIM, "Kim Past", OWNER)).toBe("added");
    const id = await deal("Quinn Past");
    await crm.setJobOwner(a, id, KIM, OWNER);
    expect(await repo.removeOwnerOnly(a, KIM)).toBe(true);
    expect((await crm.jobById(a, id))?.job.owner).toBeNull();
    expect(await repo.addMember(b, KIM, OTHER)).toBe("added");
  });
});
