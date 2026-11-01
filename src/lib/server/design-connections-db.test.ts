/**
 * Runs against a real Postgres when TEST_DATABASE_URL is set (skipped otherwise; `npm run test:db` sets it): the
 * directory and connections across three businesses (a retailer, an installer, an inspector). That a business not
 * listed can't be found or asked; that a request is answered only by the business asked and cancelled only by the one
 * asking; that a connection is one row however it is asked; and that nothing of one business's people reaches another.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { BUSINESS_TERMS_VERSION } from "@/lib/domain/design/account";

const url = process.env.TEST_DATABASE_URL;
const A = "owner@alpha-connect.test";
const B = "owner@beta-connect.test";
const C = "owner@gamma-connect.test";

describe.skipIf(!url)("the directory and connections (database)", () => {
  let db: typeof import("./db");
  let con: typeof import("./design-connections-repo");
  let repo: typeof import("./design-repo");
  let a: string;
  let b: string;
  let c: string;
  const me = (businessId: string, email: string) => ({ businessId, email });

  beforeAll(async () => {
    process.env.DATABASE_URL = url;
    db = await import("./db");
    await db.resetDbForTests();
    repo = await import("./design-repo");
    con = await import("./design-connections-repo");
    await db.query(`delete from businesses where created_by in ($1,$2,$3)`, [A, B, C]);
    a = (await repo.createBusiness(A, "Alpha Solar", BUSINESS_TERMS_VERSION, "retailer")).businessId;
    b = (await repo.createBusiness(B, "Beta Installs", BUSINESS_TERMS_VERSION, "installer")).businessId;
    c = (await repo.createBusiness(C, "Gamma Inspections", BUSINESS_TERMS_VERSION, "inspector")).businessId;
  });
  afterAll(async () => {
    await db.query(`delete from businesses where id in ($1,$2,$3)`, [a, b, c]);
    await db.resetDbForTests();
  });

  it("keeps each business's kind", async () => {
    expect((await repo.memberByEmail(B))?.businessKind).toBe("installer");
    expect((await repo.memberByEmail(C))?.businessKind).toBe("inspector");
    expect((await repo.memberByEmail(A))?.businessKind).toBe("retailer");
  });

  it("finds only listed businesses, never itself", async () => {
    expect(await con.searchDirectory(a, "beta", "all")).toEqual([]);
    await con.saveListing(b, { listed: true, suburb: "Clayton", state: "VIC", abn: "" }, B);
    await con.saveListing(a, { listed: true, suburb: "Glen Waverley", state: "VIC", abn: "" }, A);
    const found = await con.searchDirectory(a, "beta", "all");
    expect(found).toHaveLength(1);
    expect(found[0]).toMatchObject({ name: "Beta Installs", kind: "installer", suburb: "Clayton", standing: "none" });
    expect(JSON.stringify(found)).not.toContain(b);
    expect(JSON.stringify(found)).not.toContain(B);
    expect(await con.searchDirectory(a, "alpha", "all")).toEqual([]);
    expect(await con.searchDirectory(a, "beta", "inspector")).toEqual([]);
  });

  it("can't ask a business that isn't listed", async () => {
    const key = (await db.query<{ key: string }>(`select key from design_directory where business_id = $1`, [a]))[0].key;
    await con.myListing(c);
    const gammaKey = (await db.query<{ key: string }>(`select key from design_directory where business_id = $1`, [c]))[0].key;
    expect(await con.askToConnect(me(a, A), gammaKey)).toMatchObject({ ok: false, status: 404 });
    expect(await con.askToConnect(me(a, A), key)).toMatchObject({ ok: false, status: 409 });
  });

  it("asks, and only the business asked can answer", async () => {
    const [beta] = await con.searchDirectory(a, "beta", "all");
    expect(await con.askToConnect(me(a, A), beta.key)).toEqual({ ok: true, tell: B });
    expect(await con.askToConnect(me(a, A), beta.key)).toMatchObject({ ok: false, status: 409 });
    expect(await con.incomingCount(b)).toBe(1);
    expect(await con.incomingCount(a)).toBe(0);
    const [line] = await con.connectionsOf(a);
    expect(line).toMatchObject({ standing: "requested", business: { name: "Beta Installs" } });
    // The asker can't accept its own request; a business outside it can't touch it.
    expect(await con.answerConnection(me(a, A), line.id, "accept")).toMatchObject({ ok: false });
    expect(await con.answerConnection(me(c, C), line.id, "accept")).toMatchObject({ ok: false, status: 404 });
    // Beta, asked back the other way, finds the request already there.
    const [alpha] = await con.searchDirectory(b, "alpha", "all");
    expect(alpha.standing).toBe("incoming");
    expect(await con.askToConnect(me(b, B), alpha.key)).toMatchObject({ ok: false, status: 409 });
    expect(await con.answerConnection(me(b, B), line.id, "accept")).toEqual({ ok: true, tell: A });
    expect(await con.areConnected(a, b)).toBe(true);
    expect(await con.areConnected(b, a)).toBe(true);
    expect((await con.connectionsOf(b))[0]).toMatchObject({ standing: "connected", business: { name: "Alpha Solar", kind: "retailer" } });
  });

  it("disconnects from either side, and a request can be cancelled by its asker only", async () => {
    const [line] = await con.connectionsOf(b);
    expect(await con.answerConnection(me(b, B), line.id, "disconnect")).toEqual({ ok: true, tell: null });
    expect(await con.areConnected(a, b)).toBe(false);
    const [beta] = await con.searchDirectory(a, "beta", "all");
    await con.askToConnect(me(a, A), beta.key);
    const [asked] = await con.connectionsOf(a);
    expect(await con.answerConnection(me(b, B), asked.id, "cancel")).toMatchObject({ ok: false });
    expect(await con.answerConnection(me(a, A), asked.id, "cancel")).toEqual({ ok: true, tell: null });
    expect(await con.connectionsOf(b)).toEqual([]);
  });
});
