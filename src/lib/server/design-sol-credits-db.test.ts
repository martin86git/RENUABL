/**
 * Runs against a real Postgres when TEST_DATABASE_URL is set (skipped otherwise; `npm run test:db` sets it): Sol
 * credits. The month's own are used first, then bought ones; with none left nothing is taken when billing is
 * enforced (and only counted when it isn't); a pack is credited once however often Stripe says so; a credit given
 * back is back; billing details are kept; another business's credits are never touched.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { BUSINESS_TERMS_VERSION } from "@/lib/domain/design/account";
import { SOL_PER_USER } from "@/lib/domain/design/sol-credits";

const url = process.env.TEST_DATABASE_URL;
const A = "owner@alpha-sol-credits.test";
const B = "owner@beta-sol-credits.test";
const TODAY = "2026-11-01";

describe.skipIf(!url)("Sol credits (database)", () => {
  let db: typeof import("./db");
  let billing: typeof import("./design-billing-repo");
  let repo: typeof import("./design-repo");
  let a: string;
  let b: string;

  beforeAll(async () => {
    process.env.DATABASE_URL = url;
    db = await import("./db");
    await db.resetDbForTests();
    repo = await import("./design-repo");
    billing = await import("./design-billing-repo");
    await db.query(`delete from design_subscriptions where email in ($1,$2)`, [A, B]);
    await db.query(`delete from businesses where created_by in ($1,$2)`, [A, B]);
    a = (await repo.createBusiness(A, "Alpha Solar", BUSINESS_TERMS_VERSION)).businessId;
    b = (await repo.createBusiness(B, "Beta Electrical", BUSINESS_TERMS_VERSION)).businessId;
    await billing.recordSubscription({
      email: A,
      stripeCustomer: "cus_sol_alpha",
      stripeSubscription: "sub_sol_alpha",
      status: "active",
      interval: "month",
      seats: 1,
      trialEnd: null,
      periodEnd: null,
    });
  });
  afterAll(async () => {
    await db.query(`delete from design_subscriptions where email in ($1,$2)`, [A, B]);
    await db.query(`delete from businesses where created_by in ($1,$2)`, [A, B]);
  });

  it("uses the month's credits, then bought ones, then stops when enforced", async () => {
    expect(await billing.solBalanceOf(a, TODAY)).toMatchObject({ included: SOL_PER_USER, left: SOL_PER_USER });
    await db.query(
      `insert into design_sol_credits (id, business_id, change, source, month, use)
       select 'solx' || g, $1, -1, 'included', '2026-11', 'chat' from generate_series(1, ${SOL_PER_USER - 1}) g`,
      [a],
    );
    expect(await billing.spendSolCredit(a, "chat", A, TODAY, true)).toBeTruthy();
    expect(await billing.spendSolCredit(a, "chat", A, TODAY, true)).toBeNull();

    await billing.creditSolPack(a, "cs_sol_alpha_1", 500, A, TODAY);
    await billing.creditSolPack(a, "cs_sol_alpha_1", 500, A, TODAY); // Stripe says it twice: still one pack.
    expect((await billing.solBalanceOf(a, TODAY)).bought).toBe(500);
    const id = await billing.spendSolCredit(a, "inbox", A, TODAY, true);
    expect((await billing.solBalanceOf(a, TODAY)).bought).toBe(499);
    await billing.refundSolCredit(a, id!);
    expect((await billing.solBalanceOf(a, TODAY)).bought).toBe(500);
    // Next month brings the month's own back.
    expect((await billing.solBalanceOf(a, "2026-12-01")).left).toBe(SOL_PER_USER + 500);
  });

  it("only counts an answer with none left while billing isn't enforced", async () => {
    expect((await billing.solBalanceOf(b, TODAY)).left).toBe(0);
    expect(await billing.spendSolCredit(b, "chat", B, TODAY, false)).toBeTruthy();
    expect(await billing.solUseThisMonth(b, TODAY)).toEqual([{ use: "chat", count: 1 }]);
    expect((await billing.solBalanceOf(b, TODAY)).left).toBe(0);
    // Business A's packs are its own.
    expect((await billing.solBalanceOf(a, TODAY)).bought).toBe(500);
  });

  it("keeps billing details and counts the team", async () => {
    await billing.saveBillingDetails(
      a,
      { legalName: "Alpha Solar Pty Ltd", abn: "96662374905", email: "bills@alpha.test", address: "" },
      A,
    );
    expect(await billing.billingDetailsOf(a)).toMatchObject({ legalName: "Alpha Solar Pty Ltd", abn: "96662374905" });
    expect(await billing.billingDetailsOf(b)).toBeNull();
    expect(await billing.memberCount(a)).toBe(1);
  });
});
