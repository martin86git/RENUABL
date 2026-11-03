/**
 * Runs against a real Postgres when TEST_DATABASE_URL is set (skipped otherwise; `npm run test:db` sets it): the
 * Nearmap pictures a business keeps for its roofs. That a roof starts on Google's picture; that only a capture the
 * business kept can be put in use; that another business sees neither its pictures nor its choice.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { BUSINESS_TERMS_VERSION } from "@/lib/domain/design/account";

const url = process.env.TEST_DATABASE_URL;
const A = "owner@alpha-nearmap.test";
const B = "owner@beta-nearmap.test";
const roof = { lat: -37.886912, lng: 145.168123 };

describe.skipIf(!url)("Nearmap pictures (database)", () => {
  let db: typeof import("./db");
  let repo: typeof import("./design-nearmap-repo");
  let a: string;
  let b: string;

  beforeAll(async () => {
    process.env.DATABASE_URL = url;
    db = await import("./db");
    await db.resetDbForTests();
    const accounts = await import("./design-repo");
    repo = await import("./design-nearmap-repo");
    await db.query(`delete from businesses where created_by in ($1,$2)`, [A, B]);
    a = (await accounts.createBusiness(A, "Alpha Solar", BUSINESS_TERMS_VERSION, "retailer")).businessId;
    b = (await accounts.createBusiness(B, "Beta Solar", BUSINESS_TERMS_VERSION, "retailer")).businessId;
    // A capture Alpha fetched (as `fetchNearmap` keeps it), without calling Nearmap.
    await db.query(
      `insert into design_nearmap (business_id, spot, survey, captured, bytes, fetched_by) values ($1, $2, 'survey-1', '2026-09-02', $3, $4)`,
      [a, repo.spotOf(roof.lat, roof.lng), Buffer.from([0xff, 0xd8, 0xff]), A],
    );
  });
  afterAll(async () => {
    await db.query(`delete from businesses where id in ($1,$2)`, [a, b]);
    await db.resetDbForTests();
  });

  it("starts on Google's picture, and lists what the business kept", async () => {
    const got = await repo.roofImagery(a, roof.lat, roof.lng);
    expect(got.use).toBe("google");
    expect(got.kept.map((k) => [k.survey, k.captured])).toEqual([["survey-1", "2026-09-02"]]);
  });

  it("puts only a kept capture in use, and back to Google", async () => {
    expect(await repo.chooseImagery(a, roof, "survey-2")).toBe(false);
    expect(await repo.chooseImagery(a, roof, "survey-1")).toBe(true);
    expect((await repo.roofImagery(a, roof.lat, roof.lng)).use).toBe("survey-1");
    expect(await repo.keptPicture(a, roof.lat, roof.lng, "survey-1")).not.toBeNull();
    expect(await repo.chooseImagery(a, roof, "google")).toBe(true);
    expect((await repo.roofImagery(a, roof.lat, roof.lng)).use).toBe("google");
  });

  it("keeps another business out", async () => {
    await repo.chooseImagery(a, roof, "survey-1");
    expect(await repo.roofImagery(b, roof.lat, roof.lng)).toEqual({ use: "google", kept: [] });
    expect(await repo.keptPicture(b, roof.lat, roof.lng, "survey-1")).toBeNull();
    expect(await repo.chooseImagery(b, roof, "survey-1")).toBe(false);
  });
});
