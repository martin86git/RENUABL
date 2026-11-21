/**
 * Each team member's own profile photo (21 Nov 2026, Martin: "add a profile photo for each team member"). One row a
 * person (`design_member_photos`, business id first), made by this file. The photo is only ever kept as redrawn by
 * `avatarImage` (square, small, a JPEG with nothing but the picture), and only the person themselves sets or removes it.
 */
import { query } from "./db";

let ready: Promise<unknown> | null = null;
const table = () =>
  (ready ??= query(`create table if not exists design_member_photos (
  business_id text not null references businesses(id) on delete cascade,
  email text not null,
  photo bytea not null,
  photo_type text not null,
  updated_at timestamptz not null default now(),
  primary key (business_id, email)
)`).catch((e) => {
    ready = null;
    throw e;
  }));

/** Puts this person's photo in place of any before; null takes it away. */
export async function setMemberPhoto(
  businessId: string,
  email: string,
  photo: { bytes: Buffer; contentType: string } | null,
): Promise<number | null> {
  await table();
  const who = email.toLowerCase();
  if (!photo) {
    await query(`delete from design_member_photos where business_id = $1 and email = $2`, [businessId, who]);
    return null;
  }
  const rows = await query<{ v: string }>(
    `insert into design_member_photos (business_id, email, photo, photo_type) values ($1, $2, $3, $4)
     on conflict (business_id, email) do update set photo = excluded.photo, photo_type = excluded.photo_type, updated_at = now()
     returning (extract(epoch from updated_at) * 1000)::bigint::text as v`,
    [businessId, who, photo.bytes, photo.contentType],
  );
  return Number(rows[0]?.v ?? Date.now());
}

/** The photo itself, only from the asker's own business. */
export async function memberPhoto(businessId: string, email: string): Promise<{ bytes: Buffer; contentType: string } | null> {
  await table();
  const rows = await query<{ photo: Buffer; photo_type: string }>(
    `select photo, photo_type from design_member_photos where business_id = $1 and email = $2`,
    [businessId, email.toLowerCase()],
  );
  return rows[0] ? { bytes: rows[0].photo, contentType: rows[0].photo_type } : null;
}

/**
 * Who in the business has a photo, by email, each with when it was last changed: the version a page puts on the
 * photo's address, so a new photo is fetched while an unchanged one stays cached. Never fails a page: none on error.
 */
export async function memberPhotoVersions(businessId: string): Promise<Record<string, number>> {
  try {
    await table();
    const rows = await query<{ email: string; v: string }>(
      `select email, (extract(epoch from updated_at) * 1000)::bigint::text as v from design_member_photos where business_id = $1`,
      [businessId],
    );
    return Object.fromEntries(rows.map((r) => [r.email, Number(r.v)]));
  } catch {
    return {};
  }
}
