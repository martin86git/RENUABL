/**
 * Server only. A business's library of its own licensed standards (domain/design/standards.ts). Under the designer's
 * tenant rule: the business id first in every function, only ever from the signed-in member. A copy arrives in parts
 * (each under Vercel's request limit) and is ready only once every part is in and the whole reads as a PDF.
 */
import { isPdf } from "@/lib/domain/design/brand";
import { STANDARDS_LIMITS, STANDARDS_FULL, STANDARD_NOT_PDF, type StandardCopy, type StandardInput } from "@/lib/domain/design/standards";
import { query, randomToken } from "./db";

const moment = (column: string) => `to_char(${column} at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')`;

export class StandardRefusal extends Error {}

export const validStandardId = (id: string) => /^st_[a-f0-9]{16,32}$/.test(id);

/** The copies ready to open, by standard. An upload left unfinished for a day is cleared away first. */
export async function listStandards(businessId: string): Promise<StandardCopy[]> {
  await query(`delete from design_standards where business_id = $1 and not ready and at < now() - interval '1 day'`, [businessId]);
  return query<StandardCopy>(
    `select id, code, title, edition, file_name as "fileName", size, licence_by as "licenceBy", by_email as by, ${moment("at")} as at
       from design_standards where business_id = $1 and ready order by code, edition desc, at desc`,
    [businessId],
  );
}

/** Starts a copy: kept as not ready until its parts are in. The licence is ticked by the member who uploads it. */
export async function startStandard(businessId: string, input: StandardInput, by: string): Promise<string> {
  const have = await query<{ n: string }>(`select count(*) as n from design_standards where business_id = $1`, [businessId]);
  if (Number(have[0]?.n ?? 0) >= STANDARDS_LIMITS.maxCopies) throw new StandardRefusal(STANDARDS_FULL);
  const id = `st_${randomToken(10)}`;
  await query(
    `insert into design_standards (business_id, id, code, title, edition, file_name, size, parts, licence_by, by_email)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$9)`,
    [businessId, id, input.code, input.title, input.edition, input.fileName, input.size, input.parts, by.toLowerCase()],
  );
  return id;
}

/** Keeps part n of a copy still uploading. A part already sent is replaced (a retry). */
export async function putStandardPart(businessId: string, id: string, n: number, bytes: Buffer): Promise<boolean> {
  const rows = await query<{ parts: number }>(`select parts from design_standards where business_id = $1 and id = $2 and not ready`, [
    businessId,
    id,
  ]);
  const parts = rows[0]?.parts;
  if (parts === undefined || !Number.isInteger(n) || n < 0 || n >= parts) return false;
  if (bytes.length === 0 || bytes.length > STANDARDS_LIMITS.partBytes)
    throw new StandardRefusal("That part of the file is the wrong size.");
  await query(
    `insert into design_standard_parts (business_id, standard_id, n, bytes) values ($1,$2,$3,$4)
     on conflict (business_id, standard_id, n) do update set bytes = excluded.bytes`,
    [businessId, id, n, bytes],
  );
  return true;
}

/** Finishes a copy: every part in, the sizes adding up to what was said, and a whole PDF by its own bytes. */
export async function finishStandard(businessId: string, id: string): Promise<boolean> {
  const head = await query<{ size: number; parts: number }>(
    `select size, parts from design_standards where business_id = $1 and id = $2 and not ready`,
    [businessId, id],
  );
  if (!head[0]) return false;
  const parts = await query<{ n: number; len: number }>(
    `select n, length(bytes) as len from design_standard_parts where business_id = $1 and standard_id = $2 order by n`,
    [businessId, id],
  );
  const total = parts.reduce((t, p) => t + Number(p.len), 0);
  if (parts.length !== head[0].parts || parts.some((p, i) => p.n !== i) || total !== head[0].size)
    throw new StandardRefusal("Part of the file didn't arrive. Upload it again.");
  const ends = await query<{ first: Buffer; last: Buffer }>(
    `select (select substring(bytes from 1 for 8) from design_standard_parts where business_id = $1 and standard_id = $2 and n = 0) as first,
            (select substring(bytes from greatest(1, length(bytes) - 1023)) from design_standard_parts
               where business_id = $1 and standard_id = $2 and n = $3) as last`,
    [businessId, id, head[0].parts - 1],
  );
  const first = ends[0]?.first ?? Buffer.alloc(0);
  const last = ends[0]?.last ?? Buffer.alloc(0);
  if (!isPdf(new Uint8Array(Buffer.concat([first, Buffer.from("\n"), last])))) {
    await removeStandard(businessId, id);
    throw new StandardRefusal(STANDARD_NOT_PDF);
  }
  await query(`update design_standards set ready = true where business_id = $1 and id = $2`, [businessId, id]);
  return true;
}

/** A ready copy, read back a part at a time so a large file never sits whole in memory. */
export async function standardFile(
  businessId: string,
  id: string,
): Promise<{ fileName: string; size: number; parts: number; part: (n: number) => Promise<Buffer | null> } | null> {
  const rows = await query<{ fileName: string; size: number; parts: number }>(
    `select file_name as "fileName", size, parts from design_standards where business_id = $1 and id = $2 and ready`,
    [businessId, id],
  );
  const row = rows[0];
  if (!row) return null;
  return {
    ...row,
    part: async (n) =>
      (
        await query<{ bytes: Buffer }>(`select bytes from design_standard_parts where business_id = $1 and standard_id = $2 and n = $3`, [
          businessId,
          id,
          n,
        ])
      )[0]?.bytes ?? null,
  };
}

export async function removeStandard(businessId: string, id: string): Promise<boolean> {
  const rows = await query(`delete from design_standards where business_id = $1 and id = $2 returning id`, [businessId, id]);
  return rows.length > 0;
}
