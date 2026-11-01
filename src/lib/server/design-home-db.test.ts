/**
 * Runs against a real Postgres when TEST_DATABASE_URL is set (skipped otherwise; `npm run test:db` sets it): the design
 * tool's home and a deal's proposal timeline. That a deal with no design is waiting and one with a design isn't; that a
 * site drawn with no deal is listed as a site only, and can be put on a deal with no address (which then finds its
 * roof and moves to designed) but never on a deal that has one; that a member who doesn't see every deal doesn't see
 * another's; and that a publish shows on the timeline with what went out, once.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { BUSINESS_TERMS_VERSION } from "@/lib/domain/design/account";
import { cleanCustomerInput, cleanJobInput } from "@/lib/domain/design/crm";
import { buildProposal } from "@/lib/domain/design/proposal";
import { ADDRESS, PLACE, sampleInputs } from "@/lib/domain/design/proposal-fixture";
import { packDesignSet } from "@/lib/domain/design/roof-design";
import { timelineOf } from "@/lib/domain/design/timeline";
import { VERIFIED_RATES } from "@/lib/domain/rebates";

const url = process.env.TEST_DATABASE_URL;
const A = "owner@alpha-home.test";
const SAM = "sam@alpha-home.test";
const SITE = { address: "9 Elsewhere Road, Sampletown VIC 3999", lat: -37.9, lng: 145.2 };

describe.skipIf(!url)("the design tool's home (database)", () => {
  let db: typeof import("./db");
  let repo: typeof import("./design-repo");
  let crm: typeof import("./design-crm-repo");
  let home: typeof import("./design-home-repo");
  let a: string;
  let designedJob: string;
  let looseJob: string;
  let samsJob: string;
  let siteId: string;
  const all = { email: A, all: true };

  beforeAll(async () => {
    process.env.DATABASE_URL = url;
    delete process.env.SENDGRID_API_KEY;
    delete process.env.RESEND_API_KEY;
    db = await import("./db");
    await db.resetDbForTests();
    repo = await import("./design-repo");
    crm = await import("./design-crm-repo");
    home = await import("./design-home-repo");
    await db.query(`delete from businesses where created_by = $1`, [A]);
    a = (await repo.createBusiness(A, "Alpha Solar", BUSINESS_TERMS_VERSION)).businessId;
    // Read once, so the made-up customers are in before the deals of this test.
    await crm.listJobs(a);
    const sample = sampleInputs();
    await repo.saveList(a, sample.workspace.lists[0], A);

    const customer = cleanCustomerInput({ name: "Alex Example", email: "alex@example.com", address: ADDRESS, ...PLACE });
    const placed = cleanJobInput({ address: ADDRESS, ...PLACE });
    const bare = cleanJobInput({ title: "Battery" });
    if (!customer.ok || !placed.ok || !bare.ok) throw new Error("unexpected");
    const made = await crm.createCustomer(a, customer.value, placed.value, A);
    if (made === "full" || !made.job) throw new Error("unexpected");
    designedJob = made.job.id;
    const second = await crm.createJob(a, made.customer.id, bare.value, A);
    if (typeof second === "string") throw new Error(second);
    looseJob = second.id;
    const third = await crm.createJob(a, made.customer.id, bare.value, SAM);
    if (typeof third === "string") throw new Error(third);
    samsJob = third.id;
    await db.query(`update design_jobs set owner_email = $3 where business_id = $1 and id = $2`, [a, samsJob, SAM]);

    // The deal's own roof, and a site drawn with no deal.
    const work = { design: packDesignSet(sample.project.set), extras: sample.project.extras };
    await repo.createProject(a, { address: ADDRESS, ...PLACE }, work, A);
    const site = await repo.createProject(
      a,
      SITE,
      {
        design: packDesignSet({ ...sample.project.set, designs: sample.project.set.designs.map((d) => ({ ...d, ...SITE })) }),
        extras: sample.project.extras,
      },
      A,
    );
    if (site === "full") throw new Error("unexpected");
    siteId = site.project.id;

    const saved = await (await import("./design-proposal-repo")).savedFor(a, "Alpha Solar", designedJob);
    if (!saved || typeof saved === "string") throw new Error("unexpected");
    const built = buildProposal({ ...sample, version: 1, ...saved, rates: VERIFIED_RATES, images: [] });
    if (!built.ok) throw new Error(built.problems.join(" "));
    await (await import("./design-proposal-repo")).publishProposal(a, designedJob, built, A);
  });
  afterAll(async () => {
    await db.query(`delete from businesses where id = $1`, [a]);
    await db.resetDbForTests();
  });

  it("lists the deals waiting, the first proposal sent and the sites", async () => {
    const data = await home.designHome(a, all);
    const waiting = data.waiting.map((w) => w.id);
    expect(waiting).toContain(looseJob);
    expect(waiting).not.toContain(designedJob);
    expect(data.firstSent.map((f) => f.jobId)).toEqual([designedJob]);
    const site = data.sites.find((s) => s.id === siteId);
    expect(site).toMatchObject({ jobId: null, published: false });
    expect(data.sites.find((s) => s.jobId === designedJob)).toMatchObject({ published: true });
  });

  it("keeps another member's deal from someone who doesn't see every deal", async () => {
    const mine = await home.designHome(a, { email: "kim@alpha-home.test", all: false });
    expect(mine.waiting.map((w) => w.id)).not.toContain(samsJob);
    // Deals no one owns (the made-up ones) are still there for them; the owner's own are not.
    expect(mine.waiting.length).toBeGreaterThan(0);
    expect(mine.waiting.map((w) => w.id)).not.toContain(looseJob);
  });

  it("puts a site on a deal with no address, never on one with a design", async () => {
    expect(await home.attachSite(a, all, { projectId: siteId, jobId: designedJob }, A)).toMatchObject({ ok: false, status: 409 });
    expect(await home.attachSite(a, { email: "kim@alpha-home.test", all: false }, { projectId: siteId, jobId: samsJob }, A)).toMatchObject({
      ok: false,
      status: 404,
    });
    expect(await home.attachSite(a, all, { projectId: siteId, jobId: looseJob }, A)).toEqual({ ok: true });
    const job = await crm.jobById(a, looseJob);
    expect(job?.job).toMatchObject({ projectId: siteId, stage: "designed", address: SITE.address });
    expect((await home.designHome(a, all)).sites.find((s) => s.id === siteId)?.jobId).toBe(looseJob);
  });

  it("draws the publish on the timeline once, with what went out", async () => {
    const events = timelineOf(await home.timelineData(a, designedJob));
    const published = events.filter((e) => e.kind === "published");
    expect(published).toHaveLength(1);
    expect(published[0].options?.[0].youPay).toBeGreaterThan(0);
    expect(events.some((e) => e.title === "Proposal sent")).toBe(false);
  });
});
