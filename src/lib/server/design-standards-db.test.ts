/**
 * Runs against a real Postgres when TEST_DATABASE_URL is set (skipped otherwise; `npm run test:db` sets it): a
 * business's library of licensed standards. That a copy arrives in parts and is listed only once whole and a PDF, is
 * read back part by part, is turned away when it isn't a PDF, and is never seen by another business.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { BUSINESS_TERMS_VERSION } from "@/lib/domain/design/account";
import { STANDARDS_LIMITS, STANDARD_NOT_PDF, cleanStandardInput } from "@/lib/domain/design/standards";

const url = process.env.TEST_DATABASE_URL;
const A = "owner@alpha-standards.test";
const B = "owner@beta-standards.test";

/** A made-up "PDF" of a given size: the right first and last bytes, filler between. */
function fakePdf(size: number): Buffer {
  const b = Buffer.alloc(size, 0x20);
  b.write("%PDF-1.7\n", 0);
  b.write("%%EOF\n", size - 6);
  return b;
}

describe.skipIf(!url)("standards library (database)", () => {
  let db: typeof import("./db");
  let lib: typeof import("./design-standards-repo");
  let a: string;
  let b: string;

  beforeAll(async () => {
    process.env.DATABASE_URL = url;
    db = await import("./db");
    await db.resetDbForTests();
    const repo = await import("./design-repo");
    lib = await import("./design-standards-repo");
    await db.query(`delete from businesses where created_by in ($1,$2)`, [A, B]);
    a = (await repo.createBusiness(A, "Alpha Solar", BUSINESS_TERMS_VERSION)).businessId;
    b = (await repo.createBusiness(B, "Beta Electrical", BUSINESS_TERMS_VERSION)).businessId;
  });
  afterAll(async () => {
    await db.query(`delete from businesses where created_by in ($1,$2)`, [A, B]);
  });

  async function upload(businessId: string, file: Buffer) {
    const input = cleanStandardInput({ code: "AS/NZS 3000", edition: "2018", fileName: "wiring.pdf", size: file.length, licence: true });
    if (!input.ok) throw new Error(input.message);
    const id = await lib.startStandard(businessId, input.value, A);
    for (let n = 0; n < input.value.parts; n++)
      await lib.putStandardPart(businessId, id, n, file.subarray(n * STANDARDS_LIMITS.partBytes, (n + 1) * STANDARDS_LIMITS.partBytes));
    return id;
  }

  it("lists a copy only once it is whole, and reads it back part by part", async () => {
    const file = fakePdf(STANDARDS_LIMITS.partBytes * 2 + 1000);
    const id = await upload(a, file);
    expect(await lib.listStandards(a)).toEqual([]);
    expect(await lib.finishStandard(a, id)).toBe(true);
    const listed = await lib.listStandards(a);
    expect(listed).toHaveLength(1);
    expect(listed[0]).toMatchObject({ code: "AS/NZS 3000", edition: "2018", size: file.length, licenceBy: A });
    const got = await lib.standardFile(a, id);
    expect(got?.parts).toBe(3);
    const back = Buffer.concat([(await got!.part(0))!, (await got!.part(1))!, (await got!.part(2))!]);
    expect(back.equals(file)).toBe(true);
  });

  it("refuses to finish with a part missing, and turns away a file that isn't a PDF", async () => {
    const short = fakePdf(STANDARDS_LIMITS.partBytes + 10);
    const input = cleanStandardInput({ code: "AS/NZS 5139", fileName: "b.pdf", size: short.length, licence: true });
    if (!input.ok) throw new Error(input.message);
    const id = await lib.startStandard(a, input.value, A);
    await lib.putStandardPart(a, id, 0, short.subarray(0, STANDARDS_LIMITS.partBytes));
    await expect(lib.finishStandard(a, id)).rejects.toThrow(/didn't arrive/);

    const notPdf = Buffer.alloc(5000, 0x41);
    const bad = await upload(a, notPdf);
    await expect(lib.finishStandard(a, bad)).rejects.toThrow(STANDARD_NOT_PDF);
    expect(await lib.standardFile(a, bad)).toBeNull();
  });

  it("never shows or hands one business's copy to another", async () => {
    const [copy] = await lib.listStandards(a);
    expect(await lib.listStandards(b)).toEqual([]);
    expect(await lib.standardFile(b, copy.id)).toBeNull();
    expect(await lib.removeStandard(b, copy.id)).toBe(false);
    expect(await lib.removeStandard(a, copy.id)).toBe(true);
    expect(await lib.listStandards(a)).toEqual([]);
  });
});
