/**
 * Runs against a real Postgres when TEST_DATABASE_URL is set (skipped otherwise; `npm run test:db` sets it): the
 * Marketplace's job listings across three businesses: one lists a sold job, one bids, one only looks. That nothing of
 * the customer reaches the others; that a business can't bid on its own listing; that only the poster sees the bids
 * and a bidder only its own; that the street address and contact go to the poster and the business awarded only; and
 * that a bid won by an installer sends it the job on RENUABL (connected, its job card in Jobs).
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { BUSINESS_TERMS_VERSION } from "@/lib/domain/design/account";
import { cleanCustomerInput, cleanJobInput } from "@/lib/domain/design/crm";

const url = process.env.TEST_DATABASE_URL;
const A = "owner@alpha-market.test";
const B = "owner@beta-market.test";
const C = "owner@gamma-market.test";
const STREET = "12 Listing Court";

describe.skipIf(!url)("the marketplace's job listings (database)", () => {
  let db: typeof import("./db");
  let market: typeof import("./design-marketplace-repo");
  let a: string;
  let b: string;
  let c: string;
  let jobId: string;
  let listingId: string;
  const who = (businessId: string, businessName: string, email: string) => ({ businessId, businessName, email });

  beforeAll(async () => {
    process.env.DATABASE_URL = url;
    delete process.env.SENDGRID_API_KEY;
    delete process.env.RESEND_API_KEY;
    db = await import("./db");
    await db.resetDbForTests();
    const repo = await import("./design-repo");
    const crm = await import("./design-crm-repo");
    market = await import("./design-marketplace-repo");
    await db.query(`delete from businesses where created_by in ($1,$2,$3)`, [A, B, C]);
    a = (await repo.createBusiness(A, "Alpha Solar", BUSINESS_TERMS_VERSION)).businessId;
    b = (await repo.createBusiness(B, "Beta Installs", BUSINESS_TERMS_VERSION, "installer")).businessId;
    c = (await repo.createBusiness(C, "Gamma Electrical", BUSINESS_TERMS_VERSION)).businessId;
    const address = `${STREET}, Glen Waverley VIC 3150`;
    const customer = cleanCustomerInput({
      name: "Casey Private",
      email: "casey.private@example.com",
      phone: "0491 570 156",
      address,
      lat: -37.8765,
      lng: 145.1643,
    });
    const job = cleanJobInput({ address, lat: -37.8765, lng: 145.1643 });
    if (!customer.ok || !job.ok) throw new Error("unexpected");
    const made = await crm.createCustomer(a, customer.value, job.value, A);
    if (made === "full" || !made.job) throw new Error("unexpected");
    jobId = made.job.id;
  });
  afterAll(async () => {
    await db.query(`delete from businesses where id in ($1,$2,$3)`, [a, b, c]);
    await db.resetDbForTests();
  });

  it("lists only a sold job, and shows others nothing of the customer", async () => {
    const input = { notes: "Tile roof, side access", from: null, to: null, guide: 2500, openFor: 7 };
    expect(await market.createListing(who(a, "Alpha Solar", A), jobId, input)).toMatchObject({ ok: false, status: 409 });
    await db.query(`update design_jobs set stage = 'won' where business_id = $1 and id = $2`, [a, jobId]);
    const made = await market.createListing(who(a, "Alpha Solar", A), jobId, input);
    if (!made.ok) throw new Error(made.message);
    listingId = made.id;
    expect(await market.createListing(who(a, "Alpha Solar", A), jobId, input)).toMatchObject({ ok: false, status: 409 });
    const seen = await market.listingDetail(c, listingId);
    expect(seen?.listing).toMatchObject({
      suburb: "Glen Waverley",
      business: "Alpha Solar",
      mine: false,
      guide: 2500,
      near: { lat: -37.88, lng: 145.16 },
    });
    const shown = JSON.stringify(seen);
    for (const secret of ["Casey", "casey.private", "0491", STREET, a, jobId]) expect(shown).not.toContain(secret);
    expect(seen?.bids).toBeNull();
    expect(seen?.handover).toBeNull();
  });

  it("refuses a bid on your own listing, and keeps each bid to the poster and its bidder", async () => {
    expect(await market.placeBid(who(a, "Alpha Solar", A), listingId, { amount: 1000, start: null, note: "" })).toMatchObject({
      ok: false,
    });
    expect(await market.placeBid(who(b, "Beta Installs", B), listingId, { amount: 2300, start: null, note: "Crew of two" })).toEqual({
      ok: true,
    });
    expect(await market.placeBid(who(c, "Gamma Electrical", C), listingId, { amount: 2600, start: null, note: "" })).toEqual({ ok: true });
    const poster = await market.listingDetail(a, listingId);
    expect(poster?.bids?.map((x) => [x.business, x.amount]).sort()).toEqual([
      ["Beta Installs", 2300],
      ["Gamma Electrical", 2600],
    ]);
    const forB = await market.listingDetail(b, listingId);
    expect(forB?.bids).toBeNull();
    expect(forB?.listing.myBid?.amount).toBe(2300);
    expect(forB?.listing.bids).toBe(2);
  });

  it("awards one bid: the others are declined, and only the two parties get the address and contact", async () => {
    const poster = await market.listingDetail(a, listingId);
    const betaBid = poster!.bids!.find((x) => x.business === "Beta Installs")!;
    expect(await market.awardBid(who(b, "Beta Installs", B), listingId, betaBid.id)).toMatchObject({ ok: false, status: 404 });
    expect(await market.awardBid(who(a, "Alpha Solar", A), listingId, betaBid.id)).toEqual({ ok: true });
    const forB = await market.listingDetail(b, listingId);
    expect(forB?.handover).toMatchObject({
      address: expect.stringContaining(STREET),
      installer: { business: "Beta Installs" },
      poster: { email: A },
    });
    expect(forB?.listing.myBid?.status).toBe("accepted");
    const forC = await market.listingDetail(c, listingId);
    expect(forC?.handover).toBeNull();
    expect(forC?.listing.myBid?.status).toBe("declined");
    const job = await db.query<{ installer: string }>(
      `select details->>'installer' as installer from design_jobs where business_id = $1 and id = $2`,
      [a, jobId],
    );
    expect(job[0].installer).toBe("Beta Installs");
    expect(await market.placeBid(who(c, "Gamma Electrical", C), listingId, { amount: 2000, start: null, note: "" })).toMatchObject({
      ok: false,
    });
  });

  it("sends an installer that wins the job on RENUABL: connected, accepted, its job card open", async () => {
    const shares = await import("./design-job-shares-repo");
    const con = await import("./design-connections-repo");
    const forB = await market.listingDetail(b, listingId);
    expect(forB?.handover?.jobCard).toEqual(expect.any(String));
    expect((await market.listingDetail(a, listingId))?.handover?.jobCard).toBeNull();
    expect(await con.areConnected(a, b)).toBe(true);
    const [line] = await shares.jobsFor(b);
    expect(line).toMatchObject({ id: forB!.handover!.jobCard, from: "Alpha Solar", state: "accepted" });
    expect(await shares.openShared(b, line.id)).toMatchObject({ from: "Alpha Solar" });
    expect(await shares.shareOf(a, jobId)).toMatchObject({ to: "Beta Installs", state: "accepted" });
    // The job is with an installer now, so it can't be listed again until it is taken back.
    const again = await market.createListing(who(a, "Alpha Solar", A), jobId, { notes: "", from: null, to: null, guide: null, openFor: 7 });
    expect(again).toMatchObject({ ok: false, message: /already with an installer/ });
  });
});
