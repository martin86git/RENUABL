/**
 * Server only. The designer's drafts (domain/design/draft.ts) and each person's favourite products
 * (domain/design/favourites.ts). Business id first in every function, and with it the member's email: both only ever
 * from the signed-in member (`requireMember`), never from the browser. Everything kept has been through the designer's
 * own checks first (`cleanDraft`, `cleanFavourites`).
 */
import { roofKey, type RoofPlace } from "@/lib/domain/design/account";
import { cleanDraft, type DesignDraft } from "@/lib/domain/design/draft";
import { cleanFavourites, withFavourite, type FavouriteKind, type Favourites } from "@/lib/domain/design/favourites";
import { query } from "./db";

const who = (email: string) => email.trim().toLowerCase();

/** Keeps a person's draft of a roof, over any they kept before. */
export async function keepDraft(businessId: string, email: string, roof: RoofPlace, draft: DesignDraft): Promise<void> {
  await query(
    `insert into design_drafts (business_id, member_email, spot, base, design, extras, at) values ($1,$2,$3,$4,$5,$6,now())
     on conflict (business_id, member_email, spot) do update set base = excluded.base, design = excluded.design,
       extras = excluded.extras, at = now()`,
    [businessId, who(email), roofKey(roof), draft.base, JSON.stringify(draft.design), JSON.stringify(draft.extras)],
  );
}

/** A person's draft of a roof, checked again as it is read; null when there is none. */
export async function draftOf(businessId: string, email: string, roof: RoofPlace): Promise<DesignDraft | null> {
  const rows = await query<{ base: string; design: unknown; extras: unknown; at: Date }>(
    `select base, design, extras, at from design_drafts where business_id = $1 and member_email = $2 and spot = $3`,
    [businessId, who(email), roofKey(roof)],
  );
  const row = rows[0];
  return row ? cleanDraft(roof, { base: row.base, design: row.design, extras: row.extras, at: new Date(row.at).toISOString() }) : null;
}

export async function dropDraft(businessId: string, email: string, roof: RoofPlace): Promise<void> {
  await query(`delete from design_drafts where business_id = $1 and member_email = $2 and spot = $3`, [
    businessId,
    who(email),
    roofKey(roof),
  ]);
}

export async function favouritesOf(businessId: string, email: string): Promise<Favourites> {
  const rows = await query<{ favourites: unknown }>(
    `select favourites from design_favourites where business_id = $1 and member_email = $2`,
    [businessId, who(email)],
  );
  return cleanFavourites(rows[0]?.favourites);
}

/** Stars a product for this person, or takes its star off: answers with their favourites as they now stand. */
export async function setFavourite(businessId: string, email: string, kind: FavouriteKind, sku: string, on: boolean): Promise<Favourites> {
  const next = withFavourite(await favouritesOf(businessId, email), kind, sku, on);
  await query(
    `insert into design_favourites (business_id, member_email, favourites, updated_at) values ($1,$2,$3,now())
     on conflict (business_id, member_email) do update set favourites = excluded.favourites, updated_at = now()`,
    [businessId, who(email), JSON.stringify(next)],
  );
  return next;
}
