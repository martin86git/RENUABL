/**
 * Each business's own sign-in page (sign-in-page.ts). One row a business (`design_sign_in_pages`, business id first),
 * made by this file the first time the owner's settings ask for it. The address is found by its key, and only answers
 * when its name part matches too, so an old name or a guessed one finds nothing.
 */
import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { TEAM_COOKIE, TEAM_COOKIE_DAYS, keyFrom, readSignInSegment, signInPath, slugOf } from "@/lib/domain/design/sign-in-page";
import { query } from "./db";
import { designAccess } from "./design-context";
import { imageFile, loadBrand } from "./design-proposal-repo";

let ready: Promise<unknown> | null = null;
const table = () =>
  (ready ??= query(`create table if not exists design_sign_in_pages (
  business_id text primary key references businesses(id) on delete cascade,
  slug text not null,
  key text not null unique,
  made_by text not null,
  made_at timestamptz not null default now()
)`).catch((e) => {
    ready = null;
    throw e;
  }));

const freshKey = () => keyFrom(randomBytes(8));

/** Writes a new name and key for the business, trying again on the rare key already taken. */
async function makePage(businessId: string, name: string, by: string): Promise<string> {
  const slug = slugOf(name);
  for (let tries = 0; tries < 5; tries++) {
    const key = freshKey();
    try {
      await query(
        `insert into design_sign_in_pages (business_id, slug, key, made_by) values ($1, $2, $3, $4)
         on conflict (business_id) do update set slug = excluded.slug, key = excluded.key, made_by = excluded.made_by, made_at = now()`,
        [businessId, slug, key, by.toLowerCase()],
      );
      return signInPath(slug, key);
    } catch (e) {
      if (!(e instanceof Error && /unique|duplicate/i.test(e.message)) || tries === 4) throw e;
    }
  }
  throw new Error("no key");
}

/** The business's sign-in address, made the first time it is asked for. */
export async function signInPageOf(businessId: string, name: string, by: string): Promise<string> {
  await table();
  const rows = await query<{ slug: string; key: string }>(`select slug, key from design_sign_in_pages where business_id = $1`, [
    businessId,
  ]);
  return rows[0] ? signInPath(rows[0].slug, rows[0].key) : makePage(businessId, name, by);
}

/** A new address in place of the old one (which then finds nothing), named by the business's name as it is now. */
export async function renewSignInPage(businessId: string, name: string, by: string): Promise<string> {
  await table();
  return makePage(businessId, name, by);
}

export interface SignInPageView {
  name: string;
  /** The logo as a data address, small enough to put straight in the page; null when the business has none. */
  logo: string | null;
}

/** What the page shows for this name and key: the business's trading name and logo. Null for anything else. */
export async function signInPageFor(slug: string, key: string): Promise<SignInPageView | null> {
  await table();
  const rows = await query<{ business_id: string; name: string }>(
    `select p.business_id, b.name from design_sign_in_pages p join businesses b on b.id = p.business_id
      where p.key = $1 and p.slug = $2`,
    [key, slug],
  );
  const row = rows[0];
  if (!row) return null;
  const brand = await loadBrand(row.business_id, row.name);
  const logoRow = await query<{ id: string }>(
    `select id from design_files where business_id = $1 and kind = 'logo' and removed_at is null order by created_at desc limit 1`,
    [row.business_id],
  );
  const file = logoRow[0] ? await imageFile(row.business_id, logoRow[0].id) : null;
  return {
    name: brand.name.trim() || row.name,
    logo: file ? `data:${file.contentType};base64,${file.bytes.toString("base64")}` : null,
  };
}

/** The business's sign-in address if it has one; never makes one. */
export async function existingSignInPage(businessId: string): Promise<string | null> {
  await table();
  const rows = await query<{ slug: string; key: string }>(`select slug, key from design_sign_in_pages where business_id = $1`, [
    businessId,
  ]);
  return rows[0] ? signInPath(rows[0].slug, rows[0].key) : null;
}

/** Remembers a business's sign-in page on this device (from a route, where cookies can be set). */
export async function rememberSignInPage(path: string) {
  const segment = path.replace(/^\//, "");
  if (!readSignInSegment(segment)) return;
  (await cookies()).set(TEAM_COOKIE, segment, {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: TEAM_COOKIE_DAYS * 24 * 60 * 60,
  });
}

/** The sign-in page this device remembers, while it still opens (a new key made since finds nothing). */
export async function rememberedSignInPage(): Promise<string | null> {
  const segment = (await cookies()).get(TEAM_COOKIE)?.value;
  const read = segment ? readSignInSegment(segment) : null;
  if (!read) return null;
  const page = await signInPageFor(read.slug, read.key).catch(() => null);
  return page ? signInPath(read.slug, read.key) : null;
}

/**
 * Where a signed-out visit to the front page, /design or /design/sign-in goes instead: the sign-in page this device
 * remembers. Only when the session is surely signed out (a session that couldn't be checked stays where it is, so the
 * page can try again), and only while the remembered page still opens.
 */
export async function signedOutSignInPage(): Promise<string | null> {
  const access = await designAccess(true).catch(() => null);
  if (access?.state !== "signed-out") return null;
  return rememberedSignInPage().catch(() => null);
}
