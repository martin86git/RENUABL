/**
 * Runs against a real Postgres when TEST_DATABASE_URL is set (skipped otherwise; `npm run test:db` sets it): usage
 * notices. The owner is told once as Sol's month passes 50%, then 80%, then 100%; a jump past two steps sends only
 * the higher; another business is never counted; the days read back for the chart.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { BUSINESS_TERMS_VERSION } from "@/lib/domain/design/account";
import { SOL_PER_USER } from "@/lib/domain/design/sol-credits";

const url = process.env.TEST_DATABASE_URL;
const A = "owner@alpha-usage.test";
const B = "owner@beta-usage.test";
const TODAY = "2026-11-10";

describe.skipIf(!url)("Usage notices (database)", () => {
  let db: typeof import("./db");
  let billing: typeof import("./design-billing-repo");
  let meters: typeof import("./design-usage-meters");
  let a: string;
  let b: string;
  const use = (biz: string, n: number, tag: string) =>
    db.query(
      `insert into design_sol_credits (id, business_id, change, source, month, use, by_email, at)
       select 'use${tag}' || g, $1, -1, 'included', '2026-11', 'chat', $2, '2026-11-09T02:00:00Z' from generate_series(1, ${n}) g`,
      [biz, A],
    );

  beforeAll(async () => {
    process.env.DATABASE_URL = url;
    db = await import("./db");
    await db.resetDbForTests();
    const repo = await import("./design-repo");
    billing = await import("./design-billing-repo");
    meters = await import("./design-usage-meters");
    await db.query(`delete from design_subscriptions where email in ($1,$2)`, [A, B]);
    await db.query(`delete from businesses where created_by in ($1,$2)`, [A, B]);
    a = (await repo.createBusiness(A, "Alpha Solar", BUSINESS_TERMS_VERSION)).businessId;
    b = (await repo.createBusiness(B, "Beta Electrical", BUSINESS_TERMS_VERSION)).businessId;
    await billing.recordSubscription({
      email: A,
      stripeCustomer: "cus_usage_alpha",
      stripeSubscription: "sub_usage_alpha",
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

  it("tells the owner once at each step", async () => {
    expect(await meters.noticeUsage(a, TODAY)).toEqual([]);
    await use(a, SOL_PER_USER / 2, "a");
    expect(await meters.noticeUsage(a, TODAY)).toEqual([{ key: "sol", step: 50 }]);
    expect(await meters.noticeUsage(a, TODAY)).toEqual([]);
    await use(a, SOL_PER_USER / 2, "b");
    expect(await meters.noticeUsage(a, TODAY)).toEqual([{ key: "sol", step: 100 }]);
    expect(await meters.noticeUsage(a, TODAY)).toEqual([]);
    // Beta has no plan: no allowance, nothing to tell.
    await use(b, 40, "c");
    expect(await meters.noticeUsage(b, TODAY)).toEqual([]);
  });

  it("reads the month's days for the chart", async () => {
    const days = await meters.solDays(a, "2026-11");
    expect(days).toEqual([{ day: "2026-11-09", use: "chat", by: A, credits: SOL_PER_USER }]);
    expect((await meters.usageNow(a, TODAY)).meters).toEqual([{ key: "sol", used: SOL_PER_USER, included: SOL_PER_USER }]);
  });
});
