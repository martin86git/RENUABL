/**
 * Runs against a real Postgres when TEST_DATABASE_URL is set (skipped otherwise; `npm run test:db` sets it):
 * designer passwords are kept only as salted hashes, match only themselves, and an email without one says so.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const url = process.env.TEST_DATABASE_URL;
const EMAIL = "someone@passwords.test";

describe.skipIf(!url)("roof designer passwords (database)", () => {
  let db: typeof import("./db");
  let pw: typeof import("./design-passwords");

  beforeAll(async () => {
    process.env.DATABASE_URL = url;
    db = await import("./db");
    await db.resetDbForTests();
    pw = await import("./design-passwords");
    await db.query(`delete from design_passwords where email = $1`, [EMAIL]);
  });
  afterAll(async () => {
    await db.query(`delete from design_passwords where email = $1`, [EMAIL]);
  });

  it("has none until one is set", async () => {
    expect(await pw.hasPassword(EMAIL)).toBe(false);
    expect(await pw.checkPassword(EMAIL, "anything at all")).toBe("none");
  });

  it("keeps a salted hash and matches only the password set", async () => {
    await pw.setPassword(EMAIL.toUpperCase(), "correct horse battery");
    const rows = await db.query<{ hash: string }>(`select hash from design_passwords where email = $1`, [EMAIL]);
    expect(rows[0].hash).toMatch(/^scrypt\$[0-9a-f]{32}\$[0-9a-f]{128}$/);
    expect(rows[0].hash).not.toContain("correct");
    expect(await pw.checkPassword(EMAIL, "correct horse battery")).toBe("ok");
    expect(await pw.checkPassword(EMAIL, "correct horse batterY")).toBe("wrong");
    expect(await pw.hashPassword("same")).not.toBe(await pw.hashPassword("same"));
  });

  it("changes it", async () => {
    await pw.setPassword(EMAIL, "a different one entirely");
    expect(await pw.checkPassword(EMAIL, "correct horse battery")).toBe("wrong");
    expect(await pw.checkPassword(EMAIL, "a different one entirely")).toBe("ok");
  });
});
