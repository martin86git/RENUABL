/**
 * Runs against a real Postgres when TEST_DATABASE_URL is set (skipped otherwise; `npm run test:db` sets it): card
 * payments on proposals through a business's own Stripe account. Nothing can be paid until the proposal is accepted
 * and the account can take cards; only the next amount due can be paid; a payment is kept once (Stripe may say so
 * twice), only for the amount the proposal asks and only on the business's own proposal; a paid deposit is marked
 * received by Stripe and written on the customer's record.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { BUSINESS_TERMS_VERSION } from "@/lib/domain/design/account";
import { cleanCustomerInput, cleanJobInput } from "@/lib/domain/design/crm";
import { buildProposal } from "@/lib/domain/design/proposal";
import { ADDRESS, PLACE, sampleInputs } from "@/lib/domain/design/proposal-fixture";
import { packDesignSet } from "@/lib/domain/design/roof-design";
import { VERIFIED_RATES } from "@/lib/domain/rebates";

const url = process.env.TEST_DATABASE_URL;
const A = "owner@alpha-cards.test";
const B = "owner@beta-cards.test";
const TODAY = "2026-10-12";

describe.skipIf(!url)("card payments on proposals (database)", () => {
  let db: typeof import("./db");
  let repo: typeof import("./design-repo");
  let crm: typeof import("./design-crm-repo");
  let proposals: typeof import("./design-proposal-repo");
  let connect: typeof import("./design-connect-repo");
  let a: string;
  let b: string;
  let deal: { jobId: string; token: string };

  beforeAll(async () => {
    process.env.DATABASE_URL = url;
    db = await import("./db");
    await db.resetDbForTests();
    repo = await import("./design-repo");
    crm = await import("./design-crm-repo");
    proposals = await import("./design-proposal-repo");
    connect = await import("./design-connect-repo");
    await db.query(`delete from businesses where created_by in ($1,$2)`, [A, B]);
    a = (await repo.createBusiness(A, "Alpha Solar", BUSINESS_TERMS_VERSION)).businessId;
    b = (await repo.createBusiness(B, "Beta Electrical", BUSINESS_TERMS_VERSION)).businessId;
    const sample = sampleInputs();
    await repo.saveList(a, sample.workspace.lists[0], A);
    await proposals.saveBrand(
      a,
      {
        ...(await proposals.loadBrand(a, "Alpha Solar")),
        deposit: { kind: "percent", amount: 10 },
        milestones: [
          { name: "On acceptance", percent: 30 },
          { name: "On installation", percent: 70 },
        ],
      },
      A,
    );
    const customer = cleanCustomerInput({ name: "Alex Example", email: "alex@example.com", address: ADDRESS, ...PLACE });
    const job = cleanJobInput({ address: ADDRESS, ...PLACE });
    if (!customer.ok || !job.ok) throw new Error("unexpected");
    const made = await crm.createCustomer(a, customer.value, job.value, A);
    if (made === "full" || !made.job) throw new Error("unexpected");
    await repo.createProject(
      a,
      { address: ADDRESS, ...PLACE },
      { design: packDesignSet(sample.project.set), extras: sample.project.extras },
      A,
    );
    const saved = await proposals.savedFor(a, "Alpha Solar", made.job.id);
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
    const kept = await proposals.publishProposal(a, made.job.id, built, A);
    if (!kept || kept === "raced") throw new Error("unexpected");
    deal = { jobId: made.job.id, token: kept.token };
  });
  afterAll(async () => {
    await db.query(`delete from businesses where id in ($1,$2)`, [a, b]);
    await db.resetDbForTests();
  });

  it("can't be paid by card before acceptance, or before the business's account can take cards", async () => {
    expect(await proposals.cardPaymentFor(deal.token, "deposit", TODAY)).toEqual({ refuse: "not-accepted" });
    expect(await proposals.acceptProposal(deal.token, "Alex Example", TODAY, null)).toBe("accepted-now");
    const open = await proposals.publicProposal(deal.token, TODAY);
    expect(open?.payments?.dues.map((d) => d.key)).toEqual(["deposit", "m0", "m1"]);
    expect(open?.payments?.cards).toBe(false);
    expect(await proposals.cardPaymentFor(deal.token, "deposit", TODAY)).toEqual({ refuse: "cards-off" });

    await connect.saveConnectAccount(a, "acct_alpha_cards", A);
    await connect.updateConnect("acct_alpha_cards", { chargesEnabled: true, detailsSubmitted: true });
    expect((await proposals.publicProposal(deal.token, TODAY))?.payments?.cards).toBe(true);
    expect(await proposals.cardPaymentFor(deal.token, "m0", TODAY)).toEqual({ refuse: "not-next" });
  });

  it("keeps a payment once, for the amount asked, on the business's own proposal, and marks the deposit received", async () => {
    const target = await proposals.cardPaymentFor(deal.token, "deposit", TODAY);
    if (!target || "refuse" in target) throw new Error("unexpected");
    expect(target.account).toBe("acct_alpha_cards");
    const cents = Math.round(target.due.amount * 100);
    const base = { versionId: target.versionId, dueKey: "deposit" as const, feeCents: 0, account: "acct_alpha_cards", payment: null };

    // A wrong amount, or another business naming this version, is never kept.
    expect(await proposals.recordCardPayment({ ...base, businessId: a, amountCents: cents + 1, session: "cs_x1" })).toBe("unknown");
    expect(await proposals.recordCardPayment({ ...base, businessId: b, amountCents: cents, session: "cs_x2" })).toBe("unknown");

    expect(await proposals.recordCardPayment({ ...base, businessId: a, amountCents: cents, session: "cs_ok" })).toBe("kept");
    expect(await proposals.recordCardPayment({ ...base, businessId: a, amountCents: cents, session: "cs_ok" })).toBe("already");

    const open = await proposals.publicProposal(deal.token, TODAY);
    expect(open?.deposit?.standing).toBe("received");
    expect(open?.payments?.next).toBe("m0");
    expect(open?.payments?.dues[0].paidAt).toBeTruthy();
    const record = await db.query<{ text: string }>(`select text from design_activity where business_id = $1 and job_id = $2`, [
      a,
      deal.jobId,
    ]);
    expect(record.some((r) => r.text.includes("paid by card through Stripe"))).toBe(true);
    expect((await connect.feesByMonth(a))[0]).toMatchObject({ payments: 1, amountCents: cents });
  });
});
