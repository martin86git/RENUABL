/**
 * Runs against a real Postgres when TEST_DATABASE_URL is set (skipped
 * otherwise; `npm run test:db` sets it): proposals. That one business can't
 * reach another's branding, pictures or proposals; that a customer's link
 * opens their own proposal's customer copy and nothing else; and what
 * publishing, opening, accepting and withdrawing each do.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { BUSINESS_TERMS_VERSION } from "@/lib/domain/design/account";
import { IMAGE_LIMITS } from "@/lib/domain/design/brand";
import { cleanCustomerInput, cleanJobInput } from "@/lib/domain/design/crm";
import { COST_WORDS, MAX_QUESTIONS, buildProposal, type ProposalInputs, type ProposalView } from "@/lib/domain/design/proposal";
import { ADDRESS, PLACE, sampleBrand, sampleInputs } from "@/lib/domain/design/proposal-fixture";
import { packDesignSet } from "@/lib/domain/design/roof-design";
import { VERIFIED_RATES } from "@/lib/domain/rebates";

const url = process.env.TEST_DATABASE_URL;

const A = "owner@alpha-proposals.test";
const B = "owner@beta-proposals.test";
const TODAY = "2026-10-12";
const picture = (fill: number) => ({ bytes: Buffer.from([fill, fill, fill]), contentType: "image/png", width: 10, height: 10 });

function keysOf(value: unknown, found = new Set<string>()): Set<string> {
  if (Array.isArray(value)) value.forEach((v) => keysOf(v, found));
  else if (value && typeof value === "object")
    for (const [key, inner] of Object.entries(value)) {
      found.add(key.toLowerCase());
      keysOf(inner, found);
    }
  return found;
}

describe.skipIf(!url)("roof designer proposals (database)", () => {
  let db: typeof import("./db");
  let repo: typeof import("./design-repo");
  let crm: typeof import("./design-crm-repo");
  let proposals: typeof import("./design-proposal-repo");
  let a: string;
  let b: string;
  let jobId: string;
  let customerId: string;
  let token: string;

  /** Works the job's proposal out from what is saved, as the publish route does, with fixed rebate rules and a fixed day. */
  async function build(businessId: string, name: string, id: string, over: Partial<ProposalInputs["choice"]> = {}) {
    const saved = await proposals.savedFor(businessId, name, id);
    if (!saved || typeof saved === "string") throw new Error(`not saved: ${saved}`);
    const built = buildProposal({
      now: `${TODAY}T01:00:00.000Z`,
      today: TODAY,
      version: saved.nextVersion,
      job: saved.job,
      customer: saved.customer,
      project: saved.project,
      workspace: saved.workspace,
      rates: VERIFIED_RATES,
      brand: saved.brand,
      images: saved.images,
      choice: { template: saved.brand.template, validDays: saved.brand.validDays, note: "", ...over },
    });
    if (!built.ok) throw new Error(built.problems.join(" "));
    return built;
  }
  const history = async () => (await crm.customerDetail(a, customerId))!.activity.map((x) => `${x.kind}: ${x.text} (${x.by})`);

  beforeAll(async () => {
    process.env.DATABASE_URL = url;
    db = await import("./db");
    await db.resetDbForTests();
    repo = await import("./design-repo");
    crm = await import("./design-crm-repo");
    proposals = await import("./design-proposal-repo");
    await db.query(`delete from businesses where created_by in ($1,$2)`, [A, B]);
    a = (await repo.createBusiness(A, "Alpha Solar", BUSINESS_TERMS_VERSION)).businessId;
    b = (await repo.createBusiness(B, "Beta Electrical", BUSINESS_TERMS_VERSION)).businessId;

    // Alpha: a price list, a customer with a job at the example address, and that roof designed and saved.
    const sample = sampleInputs();
    await repo.saveList(a, sample.workspace.lists[0], A);
    const customer = cleanCustomerInput({ name: "Alex Example", address: ADDRESS, ...PLACE });
    const job = cleanJobInput({ address: ADDRESS, ...PLACE });
    if (!customer.ok || !job.ok) throw new Error("unexpected");
    const made = await crm.createCustomer(a, customer.value, job.value, A);
    if (made === "full" || !made.job) throw new Error("unexpected");
    customerId = made.customer.id;
    jobId = made.job.id;
    const roof = { address: ADDRESS, ...PLACE };
    const kept = await repo.createProject(a, roof, { design: packDesignSet(sample.project.set), extras: sample.project.extras }, A);
    if (kept === "full") throw new Error("unexpected");
  });
  afterAll(async () => {
    await db.query(`delete from businesses where id in ($1,$2)`, [a, b]);
    await db.resetDbForTests();
  });

  it("keeps each business's branding and pictures to itself", async () => {
    expect((await proposals.loadBrand(a, "Alpha Solar")).name).toBe("Alpha Solar");
    await proposals.saveBrand(a, { ...sampleBrand(), name: "Alpha Solar" }, A);
    expect(await proposals.loadBrand(a, "Alpha Solar")).toMatchObject({ name: "Alpha Solar", primary: "#0f4c81", abn: "51824753556" });
    // The other business still has its own starting kit.
    expect(await proposals.loadBrand(b, "Beta Electrical")).toMatchObject({ name: "Beta Electrical", primary: "#16181d", abn: "" });

    const logo = await proposals.addImage(a, "logo", picture(1), A);
    const cover = await proposals.addImage(a, "cover", picture(2), A);
    if (logo === "full" || cover === "full") throw new Error("unexpected");
    // A new logo takes the old one's place.
    const newLogo = await proposals.addImage(a, "logo", picture(3), A);
    if (newLogo === "full") throw new Error("unexpected");
    expect((await proposals.listImages(a)).map((i) => [i.kind, i.id])).toEqual([
      ["logo", newLogo.id],
      ["cover", cover.id],
    ]);
    for (let i = 0; i < IMAGE_LIMITS.photos; i++) expect(await proposals.addImage(a, "photo", picture(10 + i), A)).not.toBe("full");
    expect(await proposals.addImage(a, "photo", picture(99), A)).toBe("full");
    expect(await proposals.listImages(a)).toHaveLength(2 + IMAGE_LIMITS.photos);

    // The other business can't list, read or remove any of them.
    expect(await proposals.listImages(b)).toEqual([]);
    expect(await proposals.imageFile(b, newLogo.id)).toBeNull();
    expect(await proposals.removeImage(b, newLogo.id)).toBe(false);
    expect((await proposals.imageFile(a, newLogo.id))?.bytes.equals(Buffer.from([3, 3, 3]))).toBe(true);
  });

  it("works a proposal out only for the business's own job, and only once it has a design", async () => {
    expect(await proposals.savedFor(b, "Beta Electrical", jobId)).toBeNull();
    const bare = await crm.createJob(a, customerId, cleanJobInputValue({ title: "No roof yet" }), A);
    if (typeof bare === "string") throw new Error(bare);
    expect(await proposals.savedFor(a, "Alpha Solar", bare.id)).toBe(proposals.NO_DESIGN);
    const saved = await proposals.savedFor(a, "Alpha Solar", jobId);
    if (!saved || typeof saved === "string") throw new Error("unexpected");
    expect(saved).toMatchObject({ nextVersion: 1, customer: { name: "Alex Example" }, project: { address: ADDRESS, version: 1 } });
    expect(saved.workspace.lists.map((l) => l.name)).toEqual(["awm.xlsx"]);
    expect(saved.images.filter((i) => i.kind === "photo")).toHaveLength(IMAGE_LIMITS.photos);
  });

  it("publishes a fixed copy at a private link, moves the job on and writes it down", async () => {
    expect((await crm.jobById(a, jobId))?.job.stage).toBe("designed");
    const built = await build(a, "Alpha Solar", jobId, { note: "First go." });
    const kept = await proposals.publishProposal(a, jobId, built, A);
    if (!kept || kept === "raced") throw new Error("unexpected");
    token = kept.token;
    expect(token).toMatch(/^[a-f0-9]{48}$/);

    const [status] = await proposals.proposalVersions(a, jobId, TODAY);
    expect(status).toMatchObject({
      state: "live",
      path: `/p/${token}`,
      version: 1,
      validUntil: "2026-10-26",
      youPay: built.view.price.youPay,
      openedAt: null,
      acceptedAt: null,
    });
    expect((await crm.jobById(a, jobId))?.job).toMatchObject({ stage: "proposal", value: built.view.price.youPay });
    expect((await history()).slice(0, 2).sort()).toEqual([`proposal: Proposal sent (${A})`, `stage: Moved to Proposal sent (${A})`]);

    // The other business can't see it, publish over it or take it back.
    expect(await proposals.proposalVersions(b, jobId, TODAY)).toEqual([]);
    expect(await proposals.publishProposal(b, jobId, built, B)).toBeNull();
    expect(await proposals.withdrawProposal(b, jobId, B)).toBe(false);
  });

  it("opens the customer's copy at the link, and nothing of the business's record", async () => {
    const found = await proposals.publicProposal(token, TODAY);
    expect(found).toMatchObject({ state: "live", accepted: null, business: { name: "Alpha Solar", phone: "0491 570 006" } });
    const view = found!.view as ProposalView;
    expect(view.note).toBe("First go.");
    expect(view.customer).toEqual({ name: "Alex Example", address: ADDRESS });
    // Nothing the customer is sent, at any depth, is named for a cost; and the business's figures aren't in it by any name.
    const keys = keysOf(found);
    for (const word of COST_WORDS) expect(keys).not.toContain(word.toLowerCase());
    const kept = await db.query<{ internal: { cost: number; margin: number; priceExGst: number; lines: unknown[] } }>(
      `select internal from design_proposal_versions where business_id = $1`,
      [a],
    );
    expect(kept[0].internal.lines.length).toBeGreaterThan(4);
    const sent = JSON.stringify(found);
    for (const secret of [kept[0].internal.cost, kept[0].internal.margin, kept[0].internal.priceExGst])
      expect(sent).not.toContain(String(secret));
    expect(sent).not.toContain("JKM475N-48QL6-DB");
    expect(sent).not.toContain(A);

    // A link we never made, or one that is nearly right, opens nothing.
    for (const bad of ["", "nope", "f".repeat(48), token.slice(0, 47), `${token}0`, token.toUpperCase()]) {
      expect(await proposals.publicProposal(bad, TODAY)).toBeNull();
      expect(await proposals.publicRoof(bad)).toBeNull();
      expect(await proposals.publicPdfParts(bad)).toBeNull();
    }
    expect(await proposals.publicRoof(token)).toEqual(PLACE);
  });

  it("serves a link only the pictures its proposal was sent with", async () => {
    const view = (await proposals.publicProposal(token, TODAY))!.view!;
    const logo = view.business.logo!;
    expect((await proposals.publicImage(token, logo.id))?.contentType).toBe("image/png");
    expect(await proposals.publicImage("f".repeat(48), logo.id)).toBeNull();
    // A picture added after it was sent isn't on it, and neither is another business's.
    await proposals.removeImage(a, view.business.photos[0].id);
    const later = await proposals.addImage(a, "photo", picture(50), A);
    const theirs = await proposals.addImage(b, "logo", picture(60), B);
    if (later === "full" || theirs === "full") throw new Error("unexpected");
    expect(await proposals.publicImage(token, later.id)).toBeNull();
    expect(await proposals.publicImage(token, theirs.id)).toBeNull();
    // One taken out of the brand kit since stays on the proposal it was sent with.
    expect((await proposals.listImages(a)).some((i) => i.id === view.business.photos[0].id)).toBe(false);
    expect(await proposals.publicImage(token, view.business.photos[0].id)).not.toBeNull();
    const parts = await proposals.publicPdfParts(token);
    expect(Object.keys(parts!.images).sort()).toEqual([logo.id, view.business.cover!.id].sort());
  });

  it("brings an unopened version up to date in place, and starts a new one once the customer has seen it", async () => {
    const before = (await history()).length;
    const again = await build(a, "Alpha Solar", jobId, { note: "Second go.", template: "bold" });
    expect(again.view.version).toBe(1);
    expect(await proposals.publishProposal(a, jobId, again, A)).toEqual({ token });
    expect(await proposals.proposalVersions(a, jobId, TODAY)).toHaveLength(1);
    expect((await proposals.publicProposal(token, TODAY))!.view).toMatchObject({ version: 1, note: "Second go.", template: "bold" });
    expect((await history()).length).toBe(before);

    // The customer opens it: written down once, however often they come back.
    await proposals.markOpened(token);
    await proposals.markOpened(token);
    expect((await history()).filter((h) => h.includes("Proposal opened"))).toEqual([
      "proposal: Proposal opened by the customer (Customer)",
    ]);
    expect((await proposals.proposalVersions(a, jobId, TODAY))[0].openedAt).not.toBeNull();

    // A proposal worked out as version 1 can no longer go over what they saw.
    expect(await proposals.publishProposal(a, jobId, again, A)).toBe("raced");
    const next = await build(a, "Alpha Solar", jobId, { note: "Third go." });
    expect(next.view.version).toBe(2);
    expect(await proposals.publishProposal(a, jobId, next, A)).toEqual({ token });
    const versions = await proposals.proposalVersions(a, jobId, TODAY);
    expect(versions.map((v) => [v.version, v.openedAt !== null])).toEqual([
      [2, false],
      [1, true],
    ]);
    expect((await proposals.publicProposal(token, TODAY))!.view!.note).toBe("Third go.");
    expect((await history())[0]).toBe(`proposal: Proposal (version 2) sent (${A})`);
  });

  it("takes a question, and stops taking them past the limit", async () => {
    expect(await proposals.askQuestion(token, "Can it go on the garage?")).toBe("asked");
    expect((await history())[0]).toBe("proposal: Question on the proposal: Can it go on the garage? (Customer)");
    expect(await proposals.askQuestion("f".repeat(48), "Hello?")).toBeNull();
    await db.query(`update design_proposals set questions = $2 where business_id = $1`, [a, MAX_QUESTIONS]);
    expect(await proposals.askQuestion(token, "One more")).toBe("full");
  });

  it("lets the customer go ahead once, while the price stands, and moves the job to won", async () => {
    // Past its last day the price has lapsed: it can be read, not accepted.
    expect((await proposals.publicProposal(token, "2026-10-27"))?.state).toBe("lapsed");
    expect(await proposals.acceptProposal(token, "Alex Example", "2026-10-27")).toBe("lapsed");
    expect(await proposals.acceptProposal("f".repeat(48), "Alex Example", TODAY)).toBeNull();
    expect((await crm.jobById(a, jobId))?.job.stage).toBe("proposal");

    // Nobody is listed to be told, so there is no notice to send.
    expect(await proposals.acceptedNotice(token)).toBeNull();
    expect(await proposals.acceptProposal(token, "Alex Example", TODAY)).toBe("accepted-now");
    const found = await proposals.publicProposal(token, TODAY);
    expect(found).toMatchObject({ state: "accepted", accepted: { name: "Alex Example" } });
    expect((await crm.jobById(a, jobId))?.job.stage).toBe("won");
    expect((await history()).slice(0, 2).sort()).toEqual([
      "proposal: Proposal accepted by Alex Example (Customer)",
      "stage: Moved to Won (Customer)",
    ]);
    const [latest, first] = await proposals.proposalVersions(a, jobId, TODAY);
    expect(latest).toMatchObject({ version: 2, state: "accepted", acceptedName: "Alex Example" });
    expect(first.acceptedAt).toBeNull();
    // Who is told, once the business lists someone: its own addresses, the customer and the job, and nothing of the proposal.
    expect(await proposals.acceptedNotice(token)).toBeNull();
    await proposals.saveBrand(a, { ...(await proposals.loadBrand(a, "Alpha Solar")), notify: ["office@alpha-proposals.test"] }, A);
    const notice = await proposals.acceptedNotice(token);
    expect(notice).toEqual({
      to: ["office@alpha-proposals.test"],
      business: "Alpha Solar",
      customer: "Alex Example",
      title: "Solar",
      jobId,
      acceptedBy: "Alex Example",
    });
    expect(await proposals.acceptedNotice("f".repeat(48))).toBeNull();
    // It stays accepted: a second go changes nothing, even after its last day.
    expect(await proposals.acceptProposal(token, "Someone Else", TODAY)).toBe("accepted");
    expect((await proposals.publicProposal(token, "2027-01-01"))?.accepted?.name).toBe("Alex Example");
    expect((await proposals.publicPdfParts(token))?.accepted?.name).toBe("Alex Example");
    // What they accepted can't be published over: the next publishing is version 3.
    expect((await build(a, "Alpha Solar", jobId)).view.version).toBe(3);
  });

  it("shows nothing of a proposal once it is taken back, and comes back with the next publishing", async () => {
    expect(await proposals.withdrawProposal(a, jobId, A)).toBe(true);
    expect(await proposals.withdrawProposal(a, jobId, A)).toBe(false);
    const gone = await proposals.publicProposal(token, TODAY);
    expect(gone).toMatchObject({ state: "withdrawn", view: null, business: { name: "Alpha Solar" } });
    expect(keysOf(gone).has("price")).toBe(false);
    expect(await proposals.publicRoof(token)).toBeNull();
    expect(await proposals.publicPdfParts(token)).toBeNull();
    const logo = (await proposals.listImages(a)).find((i) => i.kind === "logo")!;
    expect(await proposals.publicImage(token, logo.id)).toBeNull();
    expect(await proposals.acceptProposal(token, "Alex Example", TODAY)).toBe("withdrawn");
    expect(await proposals.askQuestion(token, "Still there?")).toBeNull();
    expect((await history())[0]).toBe(`proposal: Proposal withdrawn (${A})`);

    const next = await build(a, "Alpha Solar", jobId);
    expect(await proposals.publishProposal(a, jobId, next, A)).toEqual({ token });
    expect(await proposals.publicProposal(token, TODAY)).toMatchObject({ state: "live", view: { version: 3 } });
    // The job was won: a new proposal doesn't move it back.
    expect((await crm.jobById(a, jobId))?.job.stage).toBe("won");
  });

  it("goes with its job, and with its business", async () => {
    expect(await crm.deleteJob(a, jobId)).toBe(true);
    expect(await proposals.publicProposal(token, TODAY)).toBeNull();
    for (const table of ["design_proposals", "design_proposal_versions"]) {
      const rows = await db.query<{ n: string }>(`select count(*) as n from ${table} where business_id = $1`, [a]);
      expect(Number(rows[0].n)).toBe(0);
    }
    await db.query(`delete from businesses where id = $1`, [a]);
    for (const table of ["design_brand", "design_files"]) {
      const rows = await db.query<{ n: string }>(`select count(*) as n from ${table} where business_id = $1`, [a]);
      expect(Number(rows[0].n)).toBe(0);
    }
    expect(await proposals.listImages(b)).toHaveLength(1);
  });
});

function cleanJobInputValue(raw: Record<string, unknown>) {
  const cleaned = cleanJobInput(raw);
  if (!cleaned.ok) throw new Error(cleaned.message);
  return cleaned.value;
}
