/**
 * Runs against a real Postgres when TEST_DATABASE_URL is set (skipped otherwise; `npm run test:db` sets it): a
 * business's plan and design tokens. That a sign-up made before the business existed is attached to it when it does,
 * the trial's jobs are given once, a bought pack is credited once however often Stripe says so, a roof uses one token
 * however often it is saved, nothing is spent past nothing, and another business's tokens are never touched.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { BUSINESS_TERMS_VERSION } from "@/lib/domain/design/account";
import { TRIAL_JOBS } from "@/lib/domain/design/plans";

const url = process.env.TEST_DATABASE_URL;
const A = "owner@alpha-billing.test";
const B = "owner@beta-billing.test";

describe.skipIf(!url)("plans and design tokens (database)", () => {
  let db: typeof import("./db");
  let billing: typeof import("./design-billing-repo");
  let repo: typeof import("./design-repo");
  let b: string;

  beforeAll(async () => {
    process.env.DATABASE_URL = url;
    db = await import("./db");
    await db.resetDbForTests();
    repo = await import("./design-repo");
    billing = await import("./design-billing-repo");
    await db.query(`delete from design_subscriptions where email in ($1,$2)`, [A, B]);
    await db.query(`delete from businesses where created_by in ($1,$2)`, [A, B]);
    b = (await repo.createBusiness(B, "Beta Electrical", BUSINESS_TERMS_VERSION)).businessId;
  });
  afterAll(async () => {
    await db.query(`delete from design_subscriptions where email in ($1,$2)`, [A, B]);
    await db.query(`delete from businesses where created_by in ($1,$2)`, [A, B]);
  });

  it("keeps a sign-up by its email until the business exists, then attaches it and gives the trial's jobs once", async () => {
    const facts = {
      email: A,
      checkoutSession: "cs_test_alpha_0000000001",
      stripeCustomer: "cus_alpha",
      stripeSubscription: "sub_alpha",
      status: "trialing",
      interval: "month" as const,
      seats: 3,
      trialEnd: Math.floor(Date.now() / 1000) + 14 * 86400,
      periodEnd: null,
    };
    await billing.recordSubscription(facts);
    await billing.recordSubscription(facts); // Stripe tells us twice: still one.
    const a = (await repo.createBusiness(A, "Alpha Solar", BUSINESS_TERMS_VERSION)).businessId;
    expect(await billing.subscriptionOf(a)).toBeNull();
    await billing.claimSubscriptions(a, A);
    await billing.claimSubscriptions(a, A);
    expect(await billing.subscriptionOf(a)).toMatchObject({ status: "trialing", seats: 3, interval: "month", stripeCustomer: "cus_alpha" });
    expect(await billing.tokenBalance(a)).toBe(TRIAL_JOBS);
    expect((await billing.subscriptionByCheckout("cs_test_alpha_0000000001"))?.businessId).toBe(a);

    await billing.updateSubscription({ ...facts, status: "active", seats: 4 });
    expect(await billing.subscriptionOf(a)).toMatchObject({ status: "active", seats: 4 });
  });

  it("credits a pack once, uses one token a roof, and spends nothing past nothing", async () => {
    const a = (await db.query<{ id: string }>(`select id from businesses where created_by = $1`, [A]))[0].id;
    await billing.creditPack(a, "cs_test_pack_0000000001", 20, A);
    await billing.creditPack(a, "cs_test_pack_0000000001", 20, A);
    expect(await billing.tokenBalance(a)).toBe(TRIAL_JOBS + 20);
    expect(await billing.spendToken(a, "roof_1", A)).toBe("used");
    expect(await billing.spendToken(a, "roof_1", A)).toBe("already");
    expect(await billing.tokenBalance(a)).toBe(TRIAL_JOBS + 19);
    expect(await billing.spendToken(b, "roof_b", B)).toBe("none");
    expect(await billing.tokenBalance(b)).toBe(0);
    expect(await billing.canStartRoof(b)).toBe(false);
    expect((await billing.tokenLedger(a)).map((l) => l.reason)).toEqual(["job", "pack", "trial"]);
  });
});
