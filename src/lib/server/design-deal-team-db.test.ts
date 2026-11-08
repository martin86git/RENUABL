/**
 * Runs against a real Postgres when TEST_DATABASE_URL is set (skipped otherwise; `npm run test:db` sets it): the team
 * chat on a deal. That everyone who may see the deal reads and writes in it and nobody else (a member who sees only
 * their own deals, another business); that an @mention notifies the member; that Sol's design request quotes the
 * customer, is written once, lands on the record and counts on the feed's pad; and that marking it done closes it.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ALL_PERMISSIONS, BUSINESS_TERMS_VERSION } from "@/lib/domain/design/account";
import { cleanCustomerInput, cleanJobInput } from "@/lib/domain/design/crm";

const url = process.env.TEST_DATABASE_URL;
const OWNER = "owner@alpha-dealteam.test";
const SAM = "sam@alpha-dealteam.test";
const OTHER = "owner@beta-dealteam.test";

describe.skipIf(!url)("the team chat on a deal (database)", () => {
  let db: typeof import("./db");
  let team: typeof import("./design-deal-team-repo");
  let notes: typeof import("./design-notifications-repo");
  let a: string;
  let b: string;
  let dealId: string;
  const owner = () => ({ businessId: a, email: OWNER, viewer: { email: OWNER, all: true } });
  const sam = () => ({ businessId: a, email: SAM, viewer: { email: SAM, all: false } });
  const outsider = () => ({ businessId: b, email: OTHER, viewer: { email: OTHER, all: true } });

  beforeAll(async () => {
    process.env.DATABASE_URL = url;
    db = await import("./db");
    await db.resetDbForTests();
    const repo = await import("./design-repo");
    const crm = await import("./design-crm-repo");
    team = await import("./design-deal-team-repo");
    notes = await import("./design-notifications-repo");
    await db.query(`delete from businesses where created_by in ($1,$2)`, [OWNER, OTHER]);
    a = (await repo.createBusiness(OWNER, "Alpha Solar", BUSINESS_TERMS_VERSION)).businessId;
    b = (await repo.createBusiness(OTHER, "Beta Electrical", BUSINESS_TERMS_VERSION)).businessId;
    expect(await repo.addMember(a, SAM, OWNER)).toBe("added");
    expect(await repo.setPermissions(a, SAM, { ...ALL_PERMISSIONS, allDeals: false })).toBe(true);
    const customer = cleanCustomerInput({ name: "Tom Owned", address: "1 Sample Street, Exampleton VIC 3000" });
    const job = cleanJobInput({ address: "1 Sample Street, Exampleton VIC 3000" });
    if (!customer.ok || !job.ok) throw new Error("unexpected");
    const made = await crm.createCustomer(a, customer.value, job.value, OWNER);
    if (made === "full" || !made.job) throw new Error("unexpected");
    dealId = made.job.id;
    // The owner owns it, so Sam (who sees only their own deals) doesn't see it.
    await db.query(`update design_jobs set owner_email = $3 where business_id = $1 and id = $2`, [a, dealId, OWNER]);
  });
  afterAll(async () => {
    await db.query(`delete from businesses where created_by in ($1,$2)`, [OWNER, OTHER]);
  });

  it("is for those who see the deal: not a member who can't, not another business", async () => {
    const said = await team.sayOnDeal(owner(), dealId, "Roof looks tight on the west side.");
    expect(said.line.by).toBe(OWNER);
    expect((await team.dealTeam(owner(), dealId)).lines.at(-1)?.text).toBe("Roof looks tight on the west side.");
    await expect(team.dealTeam(sam(), dealId)).rejects.toThrow("That deal isn't here.");
    await expect(team.sayOnDeal(sam(), dealId, "hi")).rejects.toThrow("That deal isn't here.");
    await expect(team.dealTeam(outsider(), dealId)).rejects.toThrow("That deal isn't here.");
  });

  it("notifies an @mentioned member, who can then see the deal and its chat", async () => {
    const said = await team.sayOnDeal(owner(), dealId, "@sam can you check the switchboard?");
    expect(said.told).toEqual([SAM]);
    expect((await notes.listNotifications(a, SAM))[0]?.jobId).toBe(dealId);
    expect((await team.dealTeam(sam(), dealId)).lines.length).toBeGreaterThan(0);
  });

  it("asks once for a design, quoting the customer, and counts it until it's done", async () => {
    const customerId = (await db.query<{ c: string }>(`select customer_id as c from design_jobs where id = $1`, [dealId]))[0].c;
    await db.query(
      `insert into design_activity (id, business_id, customer_id, job_id, kind, text, by_email) values ($1,$2,$3,$4,'note',$5,$6)`,
      [db.newId("act"), a, customerId, dealId, "Wants a battery for the evenings, bill about $480 a quarter.", OWNER],
    );
    expect(await team.solAsksForDesigns(a, true)).toBe(1);
    expect(await team.solAsksForDesigns(a, true)).toBe(0);
    const pads = await team.padsFor(a, [dealId]);
    expect(pads[dealId].openAsks).toHaveLength(1);
    const ask = (await team.dealTeam(owner(), dealId)).lines.find((l) => l.kind === "ask");
    expect(ask?.ask?.why[0].text).toContain("battery for the evenings");
    expect(ask?.text).toContain("I need a design for Tom");
    const record = await db.query<{ text: string; by: string }>(
      `select text, by_email as by from design_activity where business_id = $1 and job_id = $2 and by_email = 'sol'`,
      [a, dealId],
    );
    expect(record[0]?.text).toMatch(/^Asked the team: I need a design/);
    // The designer's brief, only for someone who may see the deal.
    expect((await team.dealAsk(owner(), dealId, ask!.id))?.ask?.type).toBe("design");
    await expect(team.dealAsk(outsider(), dealId, ask!.id)).rejects.toThrow();
    // A second open request of the same kind isn't written.
    expect(await team.solPostsOnDeal(a, dealId, { kind: "ask", text: "Again", ask: ask!.ask })).toBeNull();
    expect(await team.markAskDone(owner(), dealId, ask!.id, true)).toBe(true);
    expect(await team.markAskDone(owner(), dealId, ask!.id, true)).toBe(false);
    expect((await team.padsFor(a, [dealId]))[dealId].openAsks).toHaveLength(0);
    // Done, it isn't asked for again.
    expect(await team.solAsksForDesigns(a, true)).toBe(0);
  });

  it("lists a deal's chat for those who follow it, counts what they haven't read, and lets them stop", async () => {
    // The owner follows their own deal; their own lines aren't unread.
    await team.markDealSeen(owner(), dealId);
    let mine = await team.dealChats(owner());
    expect(mine.deals.map((d) => d.jobId)).toEqual([dealId]);
    expect(mine.unread).toBe(0);
    // Sam was @mentioned, so follows it; Sam writes, and the owner has one to read.
    expect((await team.dealChats(sam())).deals.map((d) => d.jobId)).toEqual([dealId]);
    await team.sayOnDeal(sam(), dealId, "Switchboard looks fine from the photo.");
    mine = await team.dealChats(owner());
    expect(mine.unread).toBe(1);
    expect(mine.deals[0].last?.text).toBe("Switchboard looks fine from the photo.");
    // Read in one place, read everywhere.
    expect((await team.dealTeam(owner(), dealId, { seen: true })).following).toBe(true);
    expect((await team.dealChats(owner())).unread).toBe(0);
    // Stopping takes it out of Sam's list; opening it again by name brings it back.
    await team.followDeal(sam(), dealId, false);
    expect((await team.dealChats(sam())).deals).toEqual([]);
    await team.openDealChat(sam(), dealId);
    expect((await team.dealChats(sam())).deals).toHaveLength(1);
    // Another business sees none of it, and can't follow it.
    expect((await team.dealChats(outsider())).deals).toEqual([]);
    await expect(team.followDeal(outsider(), dealId, true)).rejects.toThrow("That deal isn't here.");
  });

  it("keeps Sol's lines apart from another business", async () => {
    expect(await team.solPostsOnDeal(b, dealId, { kind: "note", text: "Not yours" })).toBeNull();
    expect(await team.padsFor(b, [dealId])).toEqual({});
  });
});
