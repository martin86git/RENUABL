/**
 * Runs against a real Postgres when TEST_DATABASE_URL is set (skipped otherwise; `npm run test:db` sets it): the
 * installer nominates an inspector. That only the installer of an accepted job nominates, and only a connected
 * inspector; that the inspector sees the job read only, never the customer's email, and its photos; that the outcome
 * and certificate reach the installer and the retailer and no one else; and that taking the nomination back, the job
 * being taken back, or a disconnection closes the inspector's view.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { BUSINESS_TERMS_VERSION } from "@/lib/domain/design/account";
import { cleanCustomerInput, cleanJobInput } from "@/lib/domain/design/crm";

const url = process.env.TEST_DATABASE_URL;
const R = "owner@retail-inspect.test";
const I = "owner@installer-inspect.test";
const E = "owner@inspector-inspect.test";
const X = "owner@other-inspect.test";

describe.skipIf(!url)("nominating an inspector (database)", () => {
  let db: typeof import("./db");
  let ins: typeof import("./design-inspections-repo");
  let shares: typeof import("./design-job-shares-repo");
  let con: typeof import("./design-connections-repo");
  let card: typeof import("./design-job-card-repo");
  let r: string;
  let i: string;
  let e: string;
  let x: string;
  let jobId: string;
  let shareId: string;
  let inspectorKey: string;
  let fileId: string;
  const installer = () => ({ businessId: i, businessName: "Beta Installs", email: I });
  const inspector = () => ({ businessId: e, businessName: "Gamma Inspections", email: E });
  const connect = async (from: string, fromEmail: string, to: string, toEmail: string, search: string) => {
    const [hit] = await con.searchDirectory(from, search, "all");
    await con.askToConnect({ businessId: from, email: fromEmail }, hit.key);
    const line = (await con.connectionsOf(to)).find((c) => c.standing === "incoming")!;
    await con.answerConnection({ businessId: to, email: toEmail }, line.id, "accept");
    return hit.key;
  };

  beforeAll(async () => {
    process.env.DATABASE_URL = url;
    delete process.env.SENDGRID_API_KEY;
    delete process.env.RESEND_API_KEY;
    db = await import("./db");
    await db.resetDbForTests();
    const repo = await import("./design-repo");
    const crm = await import("./design-crm-repo");
    ins = await import("./design-inspections-repo");
    shares = await import("./design-job-shares-repo");
    con = await import("./design-connections-repo");
    card = await import("./design-job-card-repo");
    await db.query(`delete from businesses where created_by in ($1,$2,$3,$4)`, [R, I, E, X]);
    r = (await repo.createBusiness(R, "Alpha Solar", BUSINESS_TERMS_VERSION, "retailer")).businessId;
    i = (await repo.createBusiness(I, "Beta Installs", BUSINESS_TERMS_VERSION, "installer")).businessId;
    e = (await repo.createBusiness(E, "Gamma Inspections", BUSINESS_TERMS_VERSION, "inspector")).businessId;
    x = (await repo.createBusiness(X, "Delta Inspections", BUSINESS_TERMS_VERSION, "inspector")).businessId;
    const address = "12 Inspect Street, Clayton VIC 3168";
    const customer = cleanCustomerInput({ name: "Casey Private", email: "casey.private@example.com", phone: "0491 570 156", address });
    const job = cleanJobInput({ address, installDate: "2026-11-20" });
    if (!customer.ok || !job.ok) throw new Error("unexpected");
    const made = await crm.createCustomer(r, customer.value, job.value, R);
    if (made === "full" || !made.job) throw new Error("unexpected");
    jobId = made.job.id;
    for (const [id, email, suburb] of [
      [i, I, "Clayton"],
      [e, E, "Oakleigh"],
      [x, X, "Dandenong"],
    ] as const)
      await con.saveListing(id, { listed: true, suburb, state: "VIC", abn: "" }, email);
    const installerKey = await connect(r, R, i, I, "beta");
    inspectorKey = await connect(i, I, e, E, "gamma");
    await shares.sendJob({ businessId: r, businessName: "Alpha Solar", email: R }, jobId, installerKey);
    shareId = (await shares.jobsFor(i))[0].id;
    // A photo from site on the job card, before anything is nominated.
    const note = await card.addJobNote(r, jobId, {
      side: "installer",
      by: "Jo (Beta Installs)",
      byEmail: null,
      text: "Arrays done",
      files: [{ name: "array.jpg", type: "image/jpeg", bytes: Buffer.from([0xff, 0xd8, 0xff, 0xe0]) }],
    });
    fileId = note!.files[0].id;
  });
  afterAll(async () => {
    await db.query(`delete from businesses where id in ($1,$2,$3,$4)`, [r, i, e, x]);
    await db.resetDbForTests();
  });

  it("needs the job accepted, and a connected inspector", async () => {
    expect((await ins.inspectorsToNominate(i)).map((n) => n.name)).toEqual(["Gamma Inspections"]);
    expect(await ins.nominate(installer(), shareId, inspectorKey)).toMatchObject({ ok: false, message: /Accept the job first/ });
    await shares.answerJob(installer(), shareId, "accept");
    const deltaKey = (await con.searchDirectory(i, "delta", "all"))[0].key;
    expect(await ins.nominate(installer(), shareId, deltaKey)).toMatchObject({ ok: false, message: /connected with/ });
    expect(await ins.nominate(installer(), shareId, inspectorKey)).toMatchObject({ ok: true, tell: E, suburb: "Clayton" });
    expect(await ins.nominate(installer(), shareId, inspectorKey)).toMatchObject({ ok: false, message: /already nominated/ });
  });

  it("shows the inspector the job read only, with its photos, never the customer's email", async () => {
    const [line] = await ins.inspectionsFor(e);
    expect(line).toMatchObject({ from: "Beta Installs", suburb: "Clayton", state: "nominated" });
    expect(await ins.nominatedCount(e)).toBe(1);
    const got = await ins.inspectionCard(e, line.id);
    expect(got?.card.customer).toEqual({ name: "Casey Private", phone: expect.any(String) });
    expect(JSON.stringify(got)).not.toContain("example.com");
    expect(got?.card.notes[0].text).toBe("Arrays done");
    expect(await ins.inspectionFile(e, line.id, fileId)).not.toBeNull();
    expect(await ins.inspectionCard(x, line.id)).toBeNull();
    expect(await ins.inspectionFile(x, line.id, fileId)).toBeNull();
  });

  it("records the outcome and certificate for the installer and retailer only", async () => {
    const [line] = await ins.inspectionsFor(e);
    const cert = { name: "coes.pdf", type: "application/pdf", bytes: Buffer.from("%PDF-1.7 test") };
    const done = await ins.recordOutcome(inspector(), line.id, { state: "passed", on: "2026-11-21", notes: "" }, cert);
    expect(done).toMatchObject({ ok: true, suburb: "Clayton" });
    if (done.ok) expect(done.tell.sort()).toEqual([I, R].sort());
    expect(await ins.inspectionOfJob(r, jobId)).toMatchObject({
      state: "passed",
      inspector: "Gamma Inspections",
      certificate: { name: "coes.pdf" },
    });
    expect((await ins.inspectionForShare(i, shareId))?.state).toBe("passed");
    for (const viewer of [r, i, e]) expect(await ins.certificateFor(viewer, line.id)).not.toBeNull();
    expect(await ins.certificateFor(x, line.id)).toBeNull();
    expect(await ins.declineInspection(inspector(), line.id)).toBe(false);
  });

  it("closes the inspector's view when the job is taken back or they disconnect", async () => {
    const [line] = await ins.inspectionsFor(e);
    expect(await ins.inspectionCard(e, line.id)).not.toBeNull();
    const [link] = (await con.connectionsOf(e)).filter((c) => c.standing === "connected");
    await con.answerConnection({ businessId: e, email: E }, link.id, "disconnect");
    expect(await ins.inspectionCard(e, line.id)).toBeNull();
    await connect(i, I, e, E, "gamma");
    expect(await ins.inspectionCard(e, line.id)).not.toBeNull();
    await shares.withdrawJob({ businessId: r, email: R }, jobId);
    expect(await ins.inspectionCard(e, line.id)).toBeNull();
    expect(await ins.inspectionFile(e, line.id, fileId)).toBeNull();
  });
});
