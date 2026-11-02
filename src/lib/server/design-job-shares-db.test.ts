/**
 * Runs against a real Postgres when TEST_DATABASE_URL is set (skipped otherwise; `npm run test:db` sets it): a retailer
 * sends a job to a connected installer. That only a connected installer can be sent it; that it shows the installer
 * nothing of the customer until accepted; that only that installer answers; that accepting opens the job card through
 * its link and names the installer on the deal; and that taking it back or disconnecting closes the card.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { BUSINESS_TERMS_VERSION } from "@/lib/domain/design/account";
import { cleanCustomerInput, cleanJobInput } from "@/lib/domain/design/crm";

const url = process.env.TEST_DATABASE_URL;
const A = "owner@alpha-share.test";
const B = "owner@beta-share.test";
const C = "owner@gamma-share.test";

describe.skipIf(!url)("sending jobs to installers (database)", () => {
  let db: typeof import("./db");
  let shares: typeof import("./design-job-shares-repo");
  let con: typeof import("./design-connections-repo");
  let card: typeof import("./design-job-card-repo");
  let a: string;
  let b: string;
  let c: string;
  let jobId: string;
  let betaKey: string;
  let gammaKey: string;
  const retailer = () => ({ businessId: a, businessName: "Alpha Solar", email: A });
  const installer = () => ({ businessId: b, businessName: "Beta Installs", email: B });

  beforeAll(async () => {
    process.env.DATABASE_URL = url;
    delete process.env.SENDGRID_API_KEY;
    delete process.env.RESEND_API_KEY;
    db = await import("./db");
    await db.resetDbForTests();
    const repo = await import("./design-repo");
    const crm = await import("./design-crm-repo");
    shares = await import("./design-job-shares-repo");
    con = await import("./design-connections-repo");
    card = await import("./design-job-card-repo");
    await db.query(`delete from businesses where created_by in ($1,$2,$3)`, [A, B, C]);
    a = (await repo.createBusiness(A, "Alpha Solar", BUSINESS_TERMS_VERSION, "retailer")).businessId;
    b = (await repo.createBusiness(B, "Beta Installs", BUSINESS_TERMS_VERSION, "installer")).businessId;
    c = (await repo.createBusiness(C, "Gamma Installs", BUSINESS_TERMS_VERSION, "installer")).businessId;
    const address = "12 Share Street, Clayton VIC 3168";
    const customer = cleanCustomerInput({ name: "Casey Private", email: "casey.private@example.com", phone: "0491 570 156", address });
    const job = cleanJobInput({ address, installDate: "2026-11-20" });
    if (!customer.ok || !job.ok) throw new Error("unexpected");
    const made = await crm.createCustomer(a, customer.value, job.value, A);
    if (made === "full" || !made.job) throw new Error("unexpected");
    jobId = made.job.id;
    // Beta lists itself and connects with Alpha; Gamma lists itself but isn't connected.
    await con.saveListing(b, { listed: true, suburb: "Clayton", state: "VIC", abn: "" }, B);
    await con.saveListing(c, { listed: true, suburb: "Dandenong", state: "VIC", abn: "" }, C);
    betaKey = (await con.searchDirectory(a, "beta", "all"))[0].key;
    gammaKey = (await con.searchDirectory(a, "gamma", "all"))[0].key;
    await con.askToConnect({ businessId: a, email: A }, betaKey);
    const [line] = await con.connectionsOf(b);
    await con.answerConnection({ businessId: b, email: B }, line.id, "accept");
  });
  afterAll(async () => {
    await db.query(`delete from businesses where id in ($1,$2,$3)`, [a, b, c]);
    await db.resetDbForTests();
  });

  it("offers only connected installers, and sends only to one", async () => {
    expect((await shares.installersToSendTo(a)).map((i) => i.name)).toEqual(["Beta Installs"]);
    expect(await shares.sendJob(retailer(), jobId, gammaKey)).toMatchObject({ ok: false, status: 409 });
    expect(await shares.sendJob(retailer(), jobId, betaKey)).toMatchObject({ ok: true, tell: B, suburb: "Clayton" });
    expect(await shares.sendJob(retailer(), jobId, betaKey)).toMatchObject({ ok: false, status: 409 });
    expect((await shares.shareOf(a, jobId))?.state).toBe("sent");
  });

  it("shows the installer the suburb, day and system only, and no card until accepted", async () => {
    const [line] = await shares.jobsFor(b);
    expect(line).toMatchObject({ from: "Alpha Solar", suburb: "Clayton", installDate: "2026-11-20", state: "sent" });
    expect(JSON.stringify(line)).not.toMatch(/Casey|Share Street|0491|example\.com/);
    expect(await shares.jobsFor(c)).toEqual([]);
    expect(await shares.waitingCount(b)).toBe(1);
    expect(await shares.openShared(b, line.id)).toBeNull();
    // Another business can't answer it.
    expect(await shares.answerJob({ businessId: c, businessName: "Gamma Installs", email: C }, line.id, "accept")).toMatchObject({
      ok: false,
      status: 404,
    });
  });

  it("opens the card once accepted, and names the installer on the deal", async () => {
    const [line] = await shares.jobsFor(b);
    expect(await shares.answerJob(installer(), line.id, "accept")).toMatchObject({ ok: true, tell: A });
    const open = await shares.openShared(b, line.id);
    expect(open?.from).toBe("Alpha Solar");
    const link = await card.cardByToken(open!.token);
    expect(link).toMatchObject({ businessId: a, jobId, installer: { name: "Beta Installs" } });
    const view = await card.jobCard({ businessId: a, businessName: "Alpha Solar" }, jobId, true);
    expect(view?.customer).toEqual({ name: "Casey Private", phone: expect.any(String) });
    const job = await db.query<{ installer: string }>(`select details->>'installer' as installer from design_jobs where id = $1`, [jobId]);
    expect(job[0].installer).toBe("Beta Installs");
  });

  it("closes the card when the retailer takes it back, and when they disconnect", async () => {
    const [line] = await shares.jobsFor(b);
    const { token } = (await shares.openShared(b, line.id))!;
    expect(await shares.withdrawJob({ businessId: a, email: A }, jobId)).toBe(true);
    expect(await card.cardByToken(token)).toBeNull();
    expect(await shares.jobsFor(b)).toEqual([]);
    // Sent again and accepted, then the two disconnect: closed again.
    await shares.sendJob(retailer(), jobId, betaKey);
    const [again] = await shares.jobsFor(b);
    await shares.answerJob(installer(), again.id, "accept");
    const reopened = (await shares.openShared(b, again.id))!;
    expect(await card.cardByToken(reopened.token)).not.toBeNull();
    const [conn] = await con.connectionsOf(a);
    await con.answerConnection({ businessId: a, email: A }, conn.id, "disconnect");
    expect(await card.cardByToken(reopened.token)).toBeNull();
    expect(await shares.openShared(b, again.id)).toBeNull();
  });
});
