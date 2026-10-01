/**
 * Runs against a real Postgres when TEST_DATABASE_URL is set (skipped otherwise):
 * the WHOOP cap under concurrent reservations, and Home Health checks.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { WHOOP_OFFER } from "@/lib/domain/whoop-offer";
import { healthPlan } from "@/lib/domain/home-health";

const url = process.env.TEST_DATABASE_URL;

describe.skipIf(!url)("WHOOP claims and Home Health (database)", () => {
  let db: typeof import("./db");
  let whoop: typeof import("./whoop-repo");
  let health: typeof import("./home-health-repo");

  beforeAll(async () => {
    process.env.DATABASE_URL = url;
    db = await import("./db");
    await db.resetDbForTests();
    whoop = await import("./whoop-repo");
    health = await import("./home-health-repo");
    await db.query("delete from whoop_claims");
    await db.query("delete from health_quotes");
    await db.query("delete from home_health");
  });
  afterAll(async () => {
    await db.resetDbForTests();
  });

  it("never gives out more than the cap, even all at once", async () => {
    const refs = Array.from({ length: WHOOP_OFFER.cap + 5 }, (_, i) => `RN-${9000 + i}`);
    const results = await Promise.all(refs.map((r) => whoop.claimWhoop(r, "2026-10-15")));
    expect(results.filter(Boolean)).toHaveLength(WHOOP_OFFER.cap);
    expect(await whoop.heldClaims()).toBe(WHOOP_OFFER.cap);
    expect(await whoop.whoopOpen("2026-10-15")).toBe(false);
  });

  it("is one per order, and a release frees a claim for someone else", async () => {
    const held = (await db.query<{ job_reference: string }>(`select job_reference from whoop_claims where status = 'claimed' limit 1`))[0]
      .job_reference;
    expect(await whoop.claimWhoop(held, "2026-10-15")).toBe(true);
    expect(await whoop.heldClaims()).toBe(WHOOP_OFFER.cap);
    expect(await whoop.setWhoopStatus(held, "released")).toBe(true);
    expect(await whoop.whoopOpen("2026-10-15")).toBe(true);
    expect(await whoop.claimWhoop("RN-99999", "2026-10-15")).toBe(true);
    expect(await whoop.whoopOpen("2026-10-15")).toBe(false);
  });

  it("moves claims forward only", async () => {
    expect(await whoop.setWhoopStatus("RN-99999", "delivered")).toBe(false);
    expect(await whoop.setWhoopStatus("RN-99999", "shipped")).toBe(true);
    expect(await whoop.setWhoopStatus("RN-99999", "released")).toBe(false);
    expect(await whoop.setWhoopStatus("RN-99999", "delivered")).toBe(true);
  });

  it("saves a check and lists its answers for the tallies", async () => {
    const answers = { "drinking-filter": "no" };
    const saved = await health.saveHealthCheck({
      reference: null,
      email: "sam@example.com",
      address: "1 Test St",
      answers,
      plan: healthPlan(answers),
      sensitiveConsent: false,
    });
    const record = (await health.healthRecord(saved.id))!;
    expect(record.plan.recommendations[0].item).toBe("drinking-filter");
    expect(await health.allHealthAnswers()).toContainEqual(answers);
    expect((await health.latestHealthFor("SAM@example.com"))?.id).toBe(saved.id);
  });
});
