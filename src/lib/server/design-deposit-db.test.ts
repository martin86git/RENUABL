/**
 * Runs against a real Postgres when TEST_DATABASE_URL is set (skipped
 * otherwise; `npm run test:db` sets it): the deposit on an accepted
 * proposal. That it is asked for only after acceptance, that what a customer
 * says about paying is kept as said and never as received, that only the
 * business's own people mark it received, that one business can't touch
 * another's, and that the fixed copy of what was accepted never changes.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { BUSINESS_TERMS_VERSION } from "@/lib/domain/design/account";
import { cleanCustomerInput, cleanJobInput } from "@/lib/domain/design/crm";
import { isReference } from "@/lib/domain/design/deposit";
import { COST_WORDS, buildProposal } from "@/lib/domain/design/proposal";
import { ADDRESS, PLACE, sampleInputs } from "@/lib/domain/design/proposal-fixture";
import { packDesignSet } from "@/lib/domain/design/roof-design";
import { VERIFIED_RATES } from "@/lib/domain/rebates";

const url = process.env.TEST_DATABASE_URL;
const A = "owner@alpha-deposit.test";
const B = "owner@beta-deposit.test";
const TODAY = "2026-10-12";
const BANK = { name: "Alpha Solar Pty Ltd", bsb: "063000", number: "12345678", reference: "" };

describe.skipIf(!url)("roof designer deposits (database)", () => {
  let db: typeof import("./db");
  let repo: typeof import("./design-repo");
  let crm: typeof import("./design-crm-repo");
  let proposals: typeof import("./design-proposal-repo");
  let a: string;
  let b: string;
  let first: { jobId: string; customerId: string; token: string };
  let second: { jobId: string; customerId: string; token: string };
  let plain: { jobId: string; customerId: string; token: string };

  /** A customer with a job at a place of their own, a design saved there, and its proposal published. */
  async function deal(businessId: string, businessName: string, by: string, name: string, shift: number) {
    const sample = sampleInputs();
    const place = { lat: PLACE.lat + shift, lng: PLACE.lng + shift };
    const customer = cleanCustomerInput({ name, email: "alex@example.com", address: ADDRESS, ...place });
    const job = cleanJobInput({ address: ADDRESS, ...place });
    if (!customer.ok || !job.ok) throw new Error("unexpected");
    const made = await crm.createCustomer(businessId, customer.value, job.value, by);
    if (made === "full" || !made.job) throw new Error("unexpected");
    await repo.createProject(
      businessId,
      { address: ADDRESS, ...place },
      { design: packDesignSet(sample.project.set), extras: sample.project.extras },
      by,
    );
    const saved = await proposals.savedFor(businessId, businessName, made.job.id);
    if (!saved || typeof saved === "string") throw new Error("unexpected");
    const built = buildProposal({
      ...sample,
      version: 1,
      job: saved.job,
      customer: saved.customer,
      project: saved.project,
      workspace: saved.workspace,
      rates: VERIFIED_RATES,
      brand: saved.brand,
      images: [],
    });
    if (!built.ok) throw new Error(built.problems.join(" "));
    const kept = await proposals.publishProposal(businessId, made.job.id, built, by);
    if (!kept || kept === "raced") throw new Error("unexpected");
    return { jobId: made.job.id, customerId: made.customer.id, token: kept.token };
  }

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
    const sample = sampleInputs();
    await repo.saveList(a, sample.workspace.lists[0], A);
    await repo.saveList(b, sample.workspace.lists[0], B);
    // Alpha asks for 10% and gives an account, but no card payment page; Beta asks for no deposit.
    await proposals.saveBrand(
      a,
      {
        ...(await proposals.loadBrand(a, "Alpha Solar")),
        deposit: { kind: "percent", amount: 10 },
        bank: BANK,
        notify: ["office@example.com"],
      },
      A,
    );
    first = await deal(a, "Alpha Solar", A, "Alex Example", 0);
    second = await deal(a, "Alpha Solar", A, "Jordan Placeholder", 0.01);
    plain = await deal(b, "Beta Electrical", B, "Casey Sample", 0.02);
  });
  afterAll(async () => {
    await db.query(`delete from businesses where id in ($1,$2)`, [a, b]);
    await db.resetDbForTests();
  });

  it("asks for nothing until the proposal is accepted", async () => {
    const open = await proposals.publicProposal(first.token, TODAY);
    expect(open?.state).toBe("live");
    expect(open?.deposit).toBeNull();
    // The amount is on the proposal all along; the prompt to pay it is not.
    expect(open?.view?.terms?.deposit).toBe(Math.round(open!.view!.price.youPay * 10) / 100);
    expect((await proposals.proposalVersions(a, first.jobId, TODAY))[0].deposit).toBeNull();
    expect(await proposals.sayPaid(first.token, "bank", TODAY)).toBe("not-accepted");
    expect(await proposals.markDeposit(a, first.jobId, true, A)).toBe(false);
  });

  it("asks for it once accepted, with a reference of the deal's own", async () => {
    expect(await proposals.acceptProposal(first.token, "Alex Example", TODAY)).toBe("accepted-now");
    expect(await proposals.acceptProposal(second.token, "Jordan Placeholder", TODAY)).toBe("accepted-now");
    const mine = await proposals.publicProposal(first.token, TODAY);
    const theirs = await proposals.publicProposal(second.token, TODAY);
    expect(mine?.deposit).toEqual({
      amount: mine!.view!.terms!.deposit,
      reference: expect.any(String),
      standing: "due",
      way: null,
      saidAt: null,
    });
    const reference = mine!.deposit!.reference!;
    expect(isReference(reference)).toBe(true);
    // Each deal's own, and nothing of the private link.
    expect(theirs!.deposit!.reference).not.toBe(reference);
    expect(first.token.toUpperCase()).not.toContain(reference);
    // The same every time it is opened.
    expect((await proposals.publicProposal(first.token, TODAY))!.deposit!.reference).toBe(reference);
    expect((await proposals.proposalVersions(a, first.jobId, TODAY))[0].deposit).toMatchObject({
      standing: "due",
      reference,
      receivedBy: null,
    });
  });

  it("gives a reference to a proposal accepted before there were any", async () => {
    await db.query(`update design_proposal_versions set deposit_ref = null where business_id = $1`, [a]);
    const again = (await proposals.publicProposal(second.token, TODAY))!.deposit!.reference;
    expect(isReference(again)).toBe(true);
    expect((await proposals.publicProposal(second.token, TODAY))!.deposit!.reference).toBe(again);
  });

  it("keeps what a customer says about paying as said, never as received", async () => {
    const before = await proposals.sentView(a, first.jobId, 1);
    // Only a way this proposal offers: it was sent with an account and no card payment page.
    expect(await proposals.sayPaid(first.token, "card", TODAY)).toBe("no-such-way");
    expect((await proposals.publicProposal(first.token, TODAY))!.deposit!.standing).toBe("due");

    expect(await proposals.sayPaid(first.token, "bank", TODAY)).toBe("said-now");
    expect(await proposals.sayPaid(first.token, "bank", TODAY)).toBe("said-before");
    const seen = (await proposals.publicProposal(first.token, TODAY))!.deposit!;
    expect(seen).toMatchObject({ standing: "said", way: "bank" });
    expect(seen.saidAt).toMatch(/^\d{4}-\d\d-\d\dT/);
    const status = (await proposals.proposalVersions(a, first.jobId, TODAY))[0].deposit!;
    expect(status).toMatchObject({ standing: "said", way: "bank", receivedAt: null, receivedBy: null });
    const rows = await db.query<{ got: string | null }>(
      `select v.deposit_received_at as got from design_proposal_versions v join design_proposals p on p.id = v.proposal_id where p.token = $1`,
      [first.token],
    );
    expect(rows[0].got).toBeNull();

    // Written once on the customer's record, as what they said.
    const said = (await crm.customerDetail(a, first.customerId))!.activity.filter((line) => /says they paid/.test(line.text));
    expect(said).toHaveLength(1);
    expect(said[0]).toMatchObject({ kind: "proposal", by: "Customer", jobId: first.jobId });
    expect(said[0].text).toMatch(/by bank transfer \(reference [A-Z2-9]{8}\)\. Not confirmed: check your account\.$/);
    expect(said[0].text).not.toMatch(/received/i);
    // The other deal is untouched, and so is the copy of what was accepted.
    expect((await proposals.publicProposal(second.token, TODAY))!.deposit!.standing).toBe("due");
    expect(await proposals.sentView(a, first.jobId, 1)).toEqual(before);
  });

  it("tells the business's own addresses what was said, without the bank details or the amount", async () => {
    const notice = await proposals.paidNotice(first.token);
    expect(notice).toMatchObject({
      to: ["office@example.com"],
      business: "Alpha Solar",
      customer: "Alex Example",
      way: "bank",
      jobId: first.jobId,
    });
    const text = JSON.stringify(notice);
    for (const secret of [BANK.number, BANK.bsb, BANK.name]) expect(text).not.toContain(secret);
    expect(Object.keys(notice!).sort()).toEqual(["business", "customer", "jobId", "reference", "title", "to", "way"]);
    // Nothing said, nothing to tell.
    expect(await proposals.paidNotice(second.token)).toBeNull();
    expect(await proposals.paidNotice("f".repeat(48))).toBeNull();
  });

  it("lets only the business's own people mark it received", async () => {
    // Another business can't mark it, see it or say it was paid for.
    expect(await proposals.markDeposit(b, first.jobId, true, B)).toBe(false);
    expect(await proposals.markDeposit(b, first.jobId, false, B)).toBe(false);
    expect(await proposals.proposalVersions(b, first.jobId, TODAY)).toEqual([]);
    expect((await proposals.proposalVersions(a, first.jobId, TODAY))[0].deposit!.standing).toBe("said");

    expect(await proposals.markDeposit(a, first.jobId, true, "Owner@Alpha-Deposit.test")).toBe(true);
    expect((await proposals.proposalVersions(a, first.jobId, TODAY))[0].deposit).toMatchObject({
      standing: "received",
      way: "bank",
      receivedBy: A,
    });
    // Twice changes nothing and writes nothing more.
    expect(await proposals.markDeposit(a, first.jobId, true, A)).toBe(true);
    const marks = (await crm.customerDetail(a, first.customerId))!.activity.filter((line) => /marked received/.test(line.text));
    expect(marks).toHaveLength(1);
    expect(marks[0]).toMatchObject({ kind: "proposal", by: A });

    // The customer sees that it has arrived, and never who marked it or anything of the business's own.
    const seen = await proposals.publicProposal(first.token, TODAY);
    expect(seen!.deposit).toMatchObject({ standing: "received", way: "bank" });
    expect(JSON.stringify(seen)).not.toContain(A);
    const keys = new Set<string>();
    JSON.stringify(seen, (key, value) => (keys.add(key.toLowerCase()), value));
    for (const word of [...COST_WORDS, "receivedBy", "businessId", "jobId"]) expect(keys.has(word.toLowerCase())).toBe(false);
    expect(await proposals.sayPaid(first.token, "bank", TODAY)).toBe("received");
    expect(await proposals.paidNotice(first.token)).toBeNull();
  });

  it("makes it due again when the business says it didn't arrive", async () => {
    expect(await proposals.markDeposit(a, first.jobId, false, A)).toBe(true);
    expect((await proposals.proposalVersions(a, first.jobId, TODAY))[0].deposit).toMatchObject({
      standing: "due",
      way: null,
      saidAt: null,
      receivedAt: null,
      receivedBy: null,
    });
    expect((await proposals.publicProposal(first.token, TODAY))!.deposit).toMatchObject({ standing: "due", way: null });
    expect(await proposals.markDeposit(a, first.jobId, false, A)).toBe(true);
    const notes = (await crm.customerDetail(a, first.customerId))!.activity.filter((line) => /marked not received/.test(line.text));
    expect(notes).toHaveLength(1);
    // The customer can say again, and the reference is the same one.
    expect(await proposals.sayPaid(first.token, "bank", TODAY)).toBe("said-now");
  });

  it("asks for nothing where the business asks for no deposit", async () => {
    expect(await proposals.acceptProposal(plain.token, "Casey Sample", TODAY)).toBe("accepted-now");
    const seen = await proposals.publicProposal(plain.token, TODAY);
    expect(seen?.state).toBe("accepted");
    expect(seen?.deposit).toBeNull();
    expect((await proposals.proposalVersions(b, plain.jobId, TODAY))[0].deposit).toBeNull();
    expect(await proposals.sayPaid(plain.token, "bank", TODAY)).toBe("no-deposit");
    expect(await proposals.markDeposit(b, plain.jobId, true, B)).toBe(false);
    expect(await proposals.markDeposit(a, plain.jobId, true, A)).toBe(false);
  });

  it("takes nothing by a link we never made, or once the proposal is withdrawn", async () => {
    for (const bad of ["", "nope", "f".repeat(48), first.token.toUpperCase()])
      expect(await proposals.sayPaid(bad, "bank", TODAY)).toBeNull();
    expect(await proposals.withdrawProposal(a, second.jobId, A)).toBe(true);
    const gone = await proposals.publicProposal(second.token, TODAY);
    expect(gone).toMatchObject({ state: "withdrawn", view: null, deposit: null });
    expect(await proposals.sayPaid(second.token, "bank", TODAY)).toBe("not-accepted");
  });
});
