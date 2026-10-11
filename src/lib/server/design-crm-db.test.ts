/**
 * Runs against a real Postgres when TEST_DATABASE_URL is set (skipped
 * otherwise; `npm run test:db` sets it): the roof designer's CRM. Above all,
 * that one business can never read or change another's customers, jobs or
 * record of what happened.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { BUSINESS_TERMS_VERSION, cleanRoofWork, type RoofPlace } from "@/lib/domain/design/account";
import {
  JOB_STAGES,
  SAMPLE_CUSTOMERS,
  cleanCustomerInput,
  cleanJobInput,
  type CustomerInput,
  type JobInput,
} from "@/lib/domain/design/crm";

const url = process.env.TEST_DATABASE_URL;

const customer = (o: Record<string, unknown>): CustomerInput => {
  const cleaned = cleanCustomerInput(o);
  if (!cleaned.ok) throw new Error(cleaned.message);
  return cleaned.value;
};
const job = (o: Record<string, unknown> = {}): JobInput => {
  const cleaned = cleanJobInput(o);
  if (!cleaned.ok) throw new Error(cleaned.message);
  return cleaned.value;
};
const ROOF: RoofPlace = { address: "8 Example Court, Glen Waverley VIC 3150", lat: -37.87812, lng: 145.16432 };
const OTHER_ROOF: RoofPlace = { address: "27 Demo Avenue, Werribee VIC 3030", lat: -37.9001, lng: 144.6601 };
const work = (roof: RoofPlace) => cleanRoofWork(roof, { lat: roof.lat, lng: roof.lng, faces: [] }, null)!;

describe.skipIf(!url)("roof designer CRM (database)", () => {
  let db: typeof import("./db");
  let repo: typeof import("./design-repo");
  let crm: typeof import("./design-crm-repo");
  let a: string;
  let b: string;
  const A = "owner@alpha-crm.test";
  const B = "owner@beta-crm.test";

  beforeAll(async () => {
    process.env.DATABASE_URL = url;
    db = await import("./db");
    await db.resetDbForTests();
    repo = await import("./design-repo");
    crm = await import("./design-crm-repo");
    await db.query(`delete from businesses where created_by in ($1,$2)`, [A, B]);
    a = (await repo.createBusiness(A, "Alpha Solar", BUSINESS_TERMS_VERSION)).businessId;
    b = (await repo.createBusiness(B, "Beta Electrical", BUSINESS_TERMS_VERSION)).businessId;
  });
  afterAll(async () => {
    await db.query(`delete from businesses where id in ($1,$2)`, [a, b]);
    await db.resetDbForTests();
  });

  it("gives a new business its five sample customers once, and never again after they are deleted", async () => {
    // Asked for twice at the same moment: still five.
    const [first] = await Promise.all([crm.listCustomers(a), crm.listCustomers(a)]);
    expect(first).toHaveLength(5);
    expect(first.map((c) => c.name)).toEqual(SAMPLE_CUSTOMERS.map((s) => s.name));
    expect(first.map((c) => c.stage)).toEqual(["lead", "lead", "designed", "proposal", "won"]);
    for (const c of first) expect(c).toMatchObject({ sample: true, jobs: 1, lat: null, lng: null });
    expect(first[0].createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    expect(await crm.listCustomers(a)).toHaveLength(5);

    const detail = await crm.customerDetail(a, first[3].id);
    expect(detail?.jobs).toHaveLength(1);
    expect(detail?.jobs[0]).toMatchObject({
      title: "Solar and battery",
      stage: "proposal",
      value: 18400,
      projectId: null,
      installDate: null,
    });
    expect(detail?.activity).toHaveLength(1);
    expect(detail?.activity[0]).toMatchObject({ kind: "email", by: "Sample", jobId: detail?.jobs[0].id });

    // The other business has its own five, none of them this one's.
    const theirs = await crm.listCustomers(b);
    expect(theirs).toHaveLength(5);
    expect(theirs.map((c) => c.id).filter((id) => first.some((c) => c.id === id))).toEqual([]);

    // Deleted, they stay gone, whichever screen asks next.
    for (const c of first) expect(await crm.deleteCustomer(a, c.id)).toBe(true);
    expect(await crm.listCustomers(a)).toEqual([]);
    expect(await crm.listJobs(a)).toEqual([]);
    expect((await crm.overview(a)).customers).toBe(0);
    expect(await crm.listCustomers(a)).toEqual([]);
    expect(await crm.listCustomers(b)).toHaveLength(5);
  });

  it("makes a customer, with a first job when they have an address", async () => {
    const withAddress = customer({ name: "Morgan Example", address: ROOF.address, lat: ROOF.lat, lng: ROOF.lng, source: "Referral" });
    const made = await crm.createCustomer(
      a,
      withAddress,
      job({ address: ROOF.address, lat: ROOF.lat, lng: ROOF.lng }),
      "Owner@Alpha-CRM.test",
    );
    if (made === "full") throw new Error("unexpected");
    expect(made.customer).toMatchObject({ ...withAddress, sample: false });
    expect(made.job).toMatchObject({
      customerId: made.customer.id,
      title: "Solar",
      stage: "lead",
      address: ROOF.address,
      lat: ROOF.lat,
      projectId: null,
    });

    const bare = await crm.createCustomer(a, customer({ name: "Riley Example" }), null, A);
    if (bare === "full") throw new Error("unexpected");
    expect(bare.job).toBeNull();

    const list = await crm.listCustomers(a);
    expect(list.map((c) => [c.name, c.jobs, c.stage])).toEqual([
      ["Riley Example", 0, null],
      ["Morgan Example", 1, "lead"],
    ]);
  });

  it("keeps each business's customers, jobs and record to itself", async () => {
    const mine = (await crm.listCustomers(a)).find((c) => c.name === "Morgan Example")!;
    const myJob = (await crm.customerDetail(a, mine.id))!.jobs[0];
    const note = await crm.addActivity(a, mine.id, { kind: "note", text: "Alpha's own note", jobId: myJob.id }, A);
    if (typeof note === "string") throw new Error(note);
    expect(note).toMatchObject({ customerId: mine.id, jobId: myJob.id, kind: "note", text: "Alpha's own note", by: A });

    // The other business can't see any of it: not listed, not by id.
    expect((await crm.listCustomers(b)).some((c) => c.id === mine.id)).toBe(false);
    expect((await crm.listJobs(b)).some((j) => j.id === myJob.id)).toBe(false);
    expect((await crm.overview(b)).recent.some((r) => r.text === "Alpha's own note")).toBe(false);
    expect(await crm.customerById(b, mine.id)).toBeNull();
    expect(await crm.customerDetail(b, mine.id)).toBeNull();
    expect(await crm.jobById(b, myJob.id)).toBeNull();

    // Nor change it, knowing the ids.
    expect(await crm.updateCustomer(b, mine.id, customer({ name: "Taken Over" }))).toBeNull();
    expect(await crm.updateJob(b, myJob.id, (current) => cleanJobInput({ stage: "lost", value: 1 }, current), B)).toBeNull();
    expect(await crm.addActivity(b, mine.id, { kind: "note", text: "Beta was here", jobId: null }, B)).toBe("missing");
    expect(await crm.createJob(b, mine.id, job({ title: "Hijack" }), B)).toBe("missing");
    expect(await crm.deleteJob(b, myJob.id)).toBe(false);
    expect(await crm.deleteCustomer(b, mine.id)).toBe(false);

    // Nor hang its own rows off this business's: a note on its own customer about this business's job is refused.
    const theirs = (await crm.listCustomers(b))[0];
    expect(await crm.addActivity(b, theirs.id, { kind: "note", text: "About someone else's job", jobId: myJob.id }, B)).toBe(
      "not-their-job",
    );
    // And within one business, a note can't name another customer's job.
    const riley = (await crm.listCustomers(a)).find((c) => c.name === "Riley Example")!;
    expect(await crm.addActivity(a, riley.id, { kind: "call", text: "Wrong job", jobId: myJob.id }, A)).toBe("not-their-job");

    // Everything is as it was.
    const after = await crm.customerDetail(a, mine.id);
    expect(after?.customer.name).toBe("Morgan Example");
    expect(after?.jobs[0]).toMatchObject({ stage: "lead", value: null });
    expect(after?.activity.map((x) => x.text)).toEqual(["Alpha's own note"]);
  });

  it("joins a job to the roof design at its address, and moves a lead to designed, once", async () => {
    const mine = (await crm.listCustomers(a)).find((c) => c.name === "Morgan Example")!;
    const before = (await crm.customerDetail(a, mine.id))!.jobs[0];

    // The other business drawing the same roof changes nothing here.
    const theirs = await repo.createProject(b, ROOF, work(ROOF), B);
    if (theirs === "full") throw new Error("unexpected");
    expect((await crm.jobById(a, before.id))?.job).toMatchObject({ projectId: null, stage: "lead" });

    const made = await repo.createProject(a, ROOF, work(ROOF), A);
    if (made === "full") throw new Error("unexpected");
    const linked = (await crm.jobById(a, before.id))!.job;
    expect(linked).toMatchObject({ projectId: made.project.id, stage: "designed" });
    expect(linked.projectId).not.toBe(theirs.project.id);
    const moves = async () => (await crm.customerDetail(a, mine.id))!.activity.filter((x) => x.kind === "stage");
    expect(await moves()).toHaveLength(1);
    expect((await moves())[0]).toMatchObject({ text: "Moved to Designed", jobId: before.id, by: A });

    // Saving the design again, or opening it again, joins nothing twice and writes nothing more.
    expect(await repo.saveProject(a, made.project.id, made.project.version, work(ROOF), A)).toEqual({ version: made.project.version + 1 });
    await repo.createProject(a, ROOF, work(ROOF), A);
    expect(await moves()).toHaveLength(1);

    // A job added later for the same roof is for that design from the start; one already past "lead" keeps its stage.
    const second = await crm.createJob(a, mine.id, job({ title: "Battery", address: ROOF.address, lat: ROOF.lat, lng: ROOF.lng }), A);
    if (typeof second === "string") throw new Error(second);
    expect(second).toMatchObject({ projectId: made.project.id, stage: "designed" });

    // A job for a roof drawn later, already at "proposal": joined by the next save of that roof, stage left alone.
    const third = await crm.createJob(a, mine.id, job({ address: OTHER_ROOF.address, lat: OTHER_ROOF.lat, lng: OTHER_ROOF.lng }), A);
    if (typeof third === "string") throw new Error(third);
    await crm.updateJob(a, third.id, (current) => cleanJobInput({ stage: "proposal" }, current), A);
    const other = await repo.createProject(a, OTHER_ROOF, work(OTHER_ROOF), A);
    if (other === "full") throw new Error("unexpected");
    expect((await crm.jobById(a, third.id))?.job).toMatchObject({ projectId: other.project.id, stage: "proposal" });

    // Moving a job to another place lets go of its design; deleting a design leaves the job, without one.
    const movedAway = await crm.updateJob(
      a,
      second.id,
      (current) => cleanJobInput({ address: "Somewhere else", lat: -37.5, lng: 145.5 }, current),
      A,
    );
    expect(movedAway).toMatchObject({ projectId: null, stage: "designed" });
    expect(await repo.deleteProject(a, other.project.id)).toBe(true);
    expect((await crm.jobById(a, third.id))?.job).toMatchObject({ projectId: null, stage: "proposal" });
  });

  it("writes down each move between stages, and only moves", async () => {
    const mine = (await crm.listCustomers(a)).find((c) => c.name === "Morgan Example")!;
    const first = (await crm.customerDetail(a, mine.id))!.jobs.find((j) => j.title === "Solar" && j.address === ROOF.address)!;
    const stageNotes = async () =>
      (await crm.customerDetail(a, mine.id))!.activity.filter((x) => x.kind === "stage" && x.jobId === first.id).map((x) => x.text);
    const before = await stageNotes();

    const priced = await crm.updateJob(
      a,
      first.id,
      (current) => cleanJobInput({ value: 9800, installDate: "2026-11-03", title: "Solar 6.6 kW" }, current),
      A,
    );
    expect(priced).toMatchObject({ value: 9800, installDate: "2026-11-03", title: "Solar 6.6 kW", stage: "designed" });
    expect(await stageNotes()).toEqual(before);

    expect(await crm.updateJob(a, first.id, (current) => cleanJobInput({ stage: "proposal" }, current), A)).toMatchObject({
      stage: "proposal",
    });
    expect(await crm.updateJob(a, first.id, (current) => cleanJobInput({ stage: "proposal" }, current), A)).toMatchObject({
      stage: "proposal",
    });
    expect(await crm.updateJob(a, first.id, (current) => cleanJobInput({ stage: "won" }, current), "Sam@Alpha-CRM.test")).toMatchObject({
      stage: "won",
      value: 9800,
    });
    const after = await stageNotes();
    expect(after.slice(0, after.length - before.length)).toEqual(["Moved to Won", "Moved to Proposal sent"]);
    expect((await crm.customerDetail(a, mine.id))!.activity[0]).toMatchObject({
      kind: "stage",
      text: "Moved to Won",
      by: "sam@alpha-crm.test",
    });

    // What can't be kept is refused with its reason, and nothing changes.
    expect(await crm.updateJob(a, first.id, (current) => cleanJobInput({ stage: "sold" }, current), A)).toHaveProperty("refused");
    expect((await crm.jobById(a, first.id))?.job.stage).toBe("won");
    expect(await crm.updateJob(a, "job_000000000000000000000000", (current) => cleanJobInput({}, current), A)).toBeNull();
  });

  it("adds the overview up for one business only", async () => {
    const mine = (await crm.listCustomers(a)).find((c) => c.name === "Morgan Example")!;
    const jobs = (await crm.customerDetail(a, mine.id))!.jobs;
    const second = jobs.find((j) => j.title === "Battery")!;
    const third = jobs.find((j) => j.address === OTHER_ROOF.address)!;
    await crm.updateJob(a, second.id, (current) => cleanJobInput({ value: 5000 }, current), A);
    await crm.updateJob(a, third.id, (current) => cleanJobInput({ value: 12000.5 }, current), A);

    const o = await crm.overview(a);
    // Solar 6.6 kW: won, $9,800. Battery: designed, $5,000. The third: proposal, $12,000.50.
    expect(Object.keys(o.counts)).toEqual([...JOB_STAGES]);
    expect(o.counts).toMatchObject({ lead: 0, designed: 1, proposal: 1, won: 1, installed: 0, lost: 0 });
    expect(o.openValue).toBe(17000.5);
    expect(o.wonValue).toBe(9800);
    expect(o.customers).toBe(2);
    expect(o.recent.length).toBeGreaterThan(3);
    expect(o.recent.length).toBeLessThanOrEqual(12);
    for (const r of o.recent) expect(r.customerName).toBe("Morgan Example");
    expect(o.recent[0].at >= o.recent[1].at).toBe(true);

    // An installed job still counts as won money; a lost one counts as neither.
    await crm.updateJob(a, second.id, (current) => cleanJobInput({ stage: "installed" }, current), A);
    await crm.updateJob(a, third.id, (current) => cleanJobInput({ stage: "lost" }, current), A);
    const later = await crm.overview(a);
    expect(later.counts).toMatchObject({ lead: 0, designed: 0, proposal: 0, won: 1, installed: 1, lost: 1 });
    expect([later.openValue, later.wonValue]).toEqual([0, 14800]);
    expect((await crm.listCustomers(a))[0]).toMatchObject({ name: "Morgan Example", jobs: 3, stage: "installed" });

    // The other business's figures are its samples' alone.
    const theirs = await crm.overview(b);
    expect(theirs.counts).toMatchObject({ lead: 2, designed: 1, proposal: 1, won: 1, installed: 0, lost: 0 });
    expect([theirs.openValue, theirs.wonValue, theirs.customers]).toEqual([28200, 8600, 5]);

    const all = await crm.listJobs(a);
    expect(all).toHaveLength(3);
    for (const j of all) expect(j.customerName).toBe("Morgan Example");
  });

  it("removes a customer's jobs and record with them, and keeps the roof design", async () => {
    const mine = (await crm.listCustomers(a)).find((c) => c.name === "Morgan Example")!;
    const jobIds = (await crm.customerDetail(a, mine.id))!.jobs.map((j) => j.id);
    // Deleting one job leaves what was written about it on the record.
    expect(await crm.deleteJob(a, jobIds[0])).toBe(true);
    expect((await crm.customerDetail(a, mine.id))!.activity.length).toBeGreaterThan(3);

    expect(await crm.deleteCustomer(a, mine.id)).toBe(true);
    for (const table of ["design_jobs", "design_activity"]) {
      const rows = await db.query<{ n: string }>(`select count(*) as n from ${table} where business_id = $1 and customer_id = $2`, [
        a,
        mine.id,
      ]);
      expect(Number(rows[0].n)).toBe(0);
    }
    expect(await repo.projectAt(a, ROOF)).not.toBeNull();
    expect((await crm.listCustomers(a)).map((c) => c.name)).toEqual(["Riley Example"]);
    // The other business is untouched.
    expect(await crm.listCustomers(b)).toHaveLength(5);
  });

  it("removes everything when the business goes", async () => {
    await db.query(`delete from businesses where id = $1`, [b]);
    for (const table of ["design_customers", "design_jobs", "design_activity"]) {
      const rows = await db.query<{ n: string }>(`select count(*) as n from ${table} where business_id = $1`, [b]);
      expect(Number(rows[0].n)).toBe(0);
    }
  });
});
