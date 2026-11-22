/**
 * Runs against a real Postgres when TEST_DATABASE_URL is set (skipped otherwise; `npm run test:db` sets it): each team
 * member's own profile photo (design-member-photos.ts). Set, read back, listed with its version for the members list,
 * replaced, taken away, and never read from another business.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { BUSINESS_TERMS_VERSION } from "@/lib/domain/design/account";

const url = process.env.TEST_DATABASE_URL;
const A = "owner@alpha-photos.test";
const B = "owner@beta-photos.test";

describe.skipIf(!url)("team members' profile photos (database)", () => {
  let db: typeof import("./db");
  let a: string;
  let b: string;

  beforeAll(async () => {
    process.env.DATABASE_URL = url;
    db = await import("./db");
    await db.resetDbForTests();
    const repo = await import("./design-repo");
    await db.query(`delete from businesses where created_by = any($1)`, [[A, B]]);
    a = (await repo.createBusiness(A, "Alpha Solar", BUSINESS_TERMS_VERSION)).businessId;
    b = (await repo.createBusiness(B, "Beta Solar", BUSINESS_TERMS_VERSION)).businessId;
  });
  afterAll(async () => {
    await db.query(`delete from businesses where created_by = any($1)`, [[A, B]]);
  });

  it("keeps a member's photo for their own business only, with a version", async () => {
    const photos = await import("./design-member-photos");
    const repo = await import("./design-repo");
    const jpeg = { bytes: Buffer.from([0xff, 0xd8, 0xff, 1, 2, 3]), contentType: "image/jpeg" };
    expect(await photos.memberPhoto(a, A)).toBeNull();
    const v1 = await photos.setMemberPhoto(a, A.toUpperCase(), jpeg);
    expect(v1).toBeGreaterThan(0);
    expect((await photos.memberPhoto(a, A))?.bytes.equals(jpeg.bytes)).toBe(true);
    expect(await photos.memberPhoto(b, A)).toBeNull();
    expect(await photos.memberPhotoVersions(a)).toEqual({ [A]: v1 });
    expect(await photos.memberPhotoVersions(b)).toEqual({});
    expect((await repo.listMembers(a)).find((m) => m.email === A)?.photo).toBe(v1);
    const v2 = await photos.setMemberPhoto(a, A, { ...jpeg, bytes: Buffer.from([0xff, 0xd8, 0xff, 9]) });
    expect(v2).toBeGreaterThanOrEqual(v1 ?? 0);
    expect((await photos.memberPhoto(a, A))?.bytes[3]).toBe(9);
    await photos.setMemberPhoto(a, A, null);
    expect(await photos.memberPhoto(a, A)).toBeNull();
    expect((await repo.listMembers(a)).find((m) => m.email === A)?.photo).toBeUndefined();
  });
});
