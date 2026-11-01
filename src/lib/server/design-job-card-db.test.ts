/**
 * Runs against a real Postgres when TEST_DATABASE_URL is set (skipped otherwise; `npm run test:db` sets it): the
 * installation job card. That an installer's link opens only its own job's card, without the customer's email; that
 * it closes once the installer is taken off the business's file; that a note and its photo stay on their job; and
 * that the card isn't emailed when email isn't set up.
 */
import sharp from "sharp";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { BUSINESS_TERMS_VERSION } from "@/lib/domain/design/account";
import { cleanCustomerInput, cleanJobInput } from "@/lib/domain/design/crm";
import { drawingSvg, jobDrawing } from "@/lib/domain/design/job-card";
import { ADDRESS, PLACE, sampleInputs } from "@/lib/domain/design/proposal-fixture";
import { packDesignSet } from "@/lib/domain/design/roof-design";

const url = process.env.TEST_DATABASE_URL;
const A = "owner@alpha-jobcard.test";
const B = "owner@beta-jobcard.test";

describe.skipIf(!url)("the installation job card (database)", () => {
  let db: typeof import("./db");
  let repo: typeof import("./design-repo");
  let cards: typeof import("./design-job-card-repo");
  let after: typeof import("./design-after-sale-repo");
  let a: string;
  let b: string;
  let jobId: string;
  let otherJob: string;
  let installerId: string;

  beforeAll(async () => {
    process.env.DATABASE_URL = url;
    delete process.env.SENDGRID_API_KEY;
    delete process.env.RESEND_API_KEY;
    db = await import("./db");
    await db.resetDbForTests();
    repo = await import("./design-repo");
    cards = await import("./design-job-card-repo");
    after = await import("./design-after-sale-repo");
    const crm = await import("./design-crm-repo");
    await db.query(`delete from businesses where created_by in ($1,$2)`, [A, B]);
    a = (await repo.createBusiness(A, "Alpha Solar", BUSINESS_TERMS_VERSION)).businessId;
    b = (await repo.createBusiness(B, "Beta Electrical", BUSINESS_TERMS_VERSION)).businessId;
    const sample = sampleInputs();
    await repo.saveList(a, sample.workspace.lists[0], A);
    const customer = cleanCustomerInput({
      name: "Alex Example",
      email: "alex@example.com",
      phone: "0491 570 006",
      address: ADDRESS,
      ...PLACE,
    });
    const job = cleanJobInput({ address: ADDRESS, ...PLACE });
    if (!customer.ok || !job.ok) throw new Error("unexpected");
    const made = await crm.createCustomer(a, customer.value, job.value, A);
    if (made === "full" || !made.job) throw new Error("unexpected");
    jobId = made.job.id;
    const theirs = cleanCustomerInput({ name: "Kim Theirs" });
    if (!theirs.ok) throw new Error("unexpected");
    const other = await crm.createCustomer(b, theirs.value, cleanJobInputValue(), B);
    if (other === "full" || !other.job) throw new Error("unexpected");
    otherJob = other.job.id;
    await repo.createProject(
      a,
      { address: ADDRESS, ...PLACE },
      { design: packDesignSet(sample.project.set), extras: sample.project.extras },
      A,
    );
    const prefs = await after.savePrefs(a, { installers: [{ name: "Sam Sparks", email: "sam@sparks.example", phone: "" }] }, A);
    installerId = prefs.installers[0].id;
  });
  afterAll(async () => {
    await db.query(`delete from businesses where id in ($1,$2)`, [a, b]);
    await db.resetDbForTests();
  });

  it("opens only its own job, without the customer's email, while the installer is on file", async () => {
    const token = await cards.installerLink(a, jobId, installerId);
    expect(await cards.installerLink(a, jobId, installerId)).toBe(token);
    const link = await cards.cardByToken(token);
    expect(link).toMatchObject({ businessId: a, jobId, installer: { name: "Sam Sparks" } });
    const card = await cards.jobCard({ businessId: a, businessName: "Alpha Solar" }, jobId, true);
    expect(card?.customer).toEqual({ name: "Alex Example", phone: "0491 570 006" });
    expect(card?.installers).toBeUndefined();
    expect(card?.layout?.marks).toContain("<polygon");
    // Another business's job is never this business's card.
    expect(await cards.jobCard({ businessId: a, businessName: "Alpha Solar" }, otherJob)).toBeNull();
    await after.savePrefs(a, { installers: [] }, A);
    expect(await cards.cardByToken(token)).toBeNull();
  });

  it("keeps a note and its photo on their job, and writes the note on the deal's record", async () => {
    const note = await cards.addJobNote(a, jobId, {
      side: "installer",
      by: "Sam Sparks",
      byEmail: null,
      text: "Roof is tin.",
      files: [{ name: "roof.png", type: "image/png", bytes: Buffer.from("png") }],
    });
    expect(note?.files).toHaveLength(1);
    expect(await cards.jobFile(a, jobId, note!.files[0].id)).toMatchObject({ name: "roof.png" });
    expect(await cards.jobFile(b, jobId, note!.files[0].id)).toBeNull();
    expect(await cards.addJobNote(b, jobId, { side: "team", by: "x", byEmail: null, text: "x", files: [] })).toBeNull();
    const logged = await db.query<{ text: string }>(
      `select text from design_activity where business_id = $1 and job_id = $2 and kind = 'note'`,
      [a, jobId],
    );
    expect(logged.map((l) => l.text)).toContain("Job card, from Sam Sparks: Roof is tin. (1 photo)");
  });

  it("isn't emailed when email isn't set up, and its drawings make pictures", async () => {
    const { sendJobCard } = await import("./design-job-card");
    expect(await sendJobCard({ businessId: a, businessName: "Alpha Solar", email: A }, jobId, installerId)).toMatchObject({
      ok: false,
      status: 409,
    });
    const design = sampleInputs().project.set.designs[0];
    const png = await sharp(Buffer.from(drawingSvg(jobDrawing(design, "layout")!, null)))
      .png()
      .toBuffer();
    expect(png.subarray(1, 4).toString()).toBe("PNG");
  });

  it("keeps the as-built on its own job, starts from the design, and writes how it differs on the record", async () => {
    const card = await cards.jobCard({ businessId: a, businessName: "Alpha Solar" }, jobId);
    expect(card?.designed?.panels).toBeGreaterThan(0);
    expect(card?.asBuilt).toBeNull();
    const designed = card!.designed!;
    const built = await cards.saveAsBuilt(
      a,
      jobId,
      {
        installedOn: "2026-11-20",
        panels: { model: designed.panelModel, count: designed.panels - 1 },
        panelSerials: ["p1", "p2"],
        inverters: [],
        notes: "",
      },
      "Jo (Sparks)",
      [`Panels: ${designed.panels} designed, ${designed.panels - 1} installed.`],
    );
    expect(built).toMatchObject({ installedOn: "2026-11-20", panelSerials: ["P1", "P2"], by: "Jo (Sparks)" });
    expect((await cards.jobCard({ businessId: a, businessName: "Alpha Solar" }, jobId))?.asBuilt?.panels.count).toBe(designed.panels - 1);
    const noted = await db.query<{ text: string }>(
      `select text from design_activity where business_id = $1 and job_id = $2 and text like 'As built%'`,
      [a, jobId],
    );
    expect(noted[0]?.text).toContain("installed");
    // Another business can neither keep one on this job nor read it.
    expect(await cards.saveAsBuilt(b, jobId, {}, "x", [])).toBeNull();
    expect(await cards.asBuiltOf(b, jobId)).toBeNull();
  });
});

function cleanJobInputValue() {
  const job = cleanJobInput({ title: "Solar" });
  if (!job.ok) throw new Error("unexpected");
  return job.value;
}
