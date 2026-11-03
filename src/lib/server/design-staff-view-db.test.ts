/**
 * Runs against a real Postgres when TEST_DATABASE_URL is set (skipped otherwise; `npm run test:db` sets it): the
 * sample businesses RENUABL staff look through (Settings → View as). That one of each kind is made, listed and
 * connected (retailer with installer, installer with inspector), and that doing it again changes nothing.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { SAMPLE_BUSINESSES } from "@/lib/domain/design/staff-view";

const url = process.env.TEST_DATABASE_URL;

describe.skipIf(!url)("staff View as: the sample businesses (database)", () => {
  let db: typeof import("./db");
  let view: typeof import("./design-staff-view");
  let repo: typeof import("./design-repo");
  let con: typeof import("./design-connections-repo");
  const clear = () => db.query(`delete from businesses where created_by = any($1)`, [SAMPLE_BUSINESSES.map((s) => s.email)]);

  beforeAll(async () => {
    process.env.DATABASE_URL = url;
    db = await import("./db");
    await db.resetDbForTests();
    view = await import("./design-staff-view");
    repo = await import("./design-repo");
    con = await import("./design-connections-repo");
    await clear();
  });
  afterAll(async () => {
    await clear();
    await db.resetDbForTests();
  });

  it("makes one business of each kind, connected along the job's way", async () => {
    await view.readySamples();
    const [retailer, installer, inspector] = await Promise.all(SAMPLE_BUSINESSES.map((s) => repo.memberByEmail(s.email)));
    expect([retailer?.businessKind, installer?.businessKind, inspector?.businessKind]).toEqual(["retailer", "installer", "inspector"]);
    const ofInstaller = await con.connectionsOf(installer!.businessId);
    expect(
      ofInstaller
        .filter((l) => l.standing === "connected")
        .map((l) => l.business.kind)
        .sort(),
    ).toEqual(["inspector", "retailer"]);
    const ofRetailer = await con.connectionsOf(retailer!.businessId);
    expect(ofRetailer.map((l) => [l.business.kind, l.standing])).toEqual([["installer", "connected"]]);
  });

  it("changes nothing when asked again", async () => {
    await view.readySamples();
    const installer = await repo.memberByEmail(SAMPLE_BUSINESSES[1].email);
    expect((await con.connectionsOf(installer!.businessId)).length).toBe(2);
  });
});
