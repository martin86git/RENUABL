/**
 * Server only. The directory and connections (domain/design/connections.ts). Every function takes the signed-in
 * member's business id first. Another business is only ever reached by its directory key, and only while it is
 * listed (searching and asking) or already in a connection with this one (answering, disconnecting); its id, people
 * and their emails never leave this file, except the owner's email, used here to tell them of a request.
 */
import { randomBytes } from "node:crypto";
import { cleanKind, type BusinessKind } from "@/lib/domain/design/business-kind";
import {
  MAX_RESULTS,
  NOT_LISTED,
  matchesSearch,
  requestRefusal,
  type AuState,
  type DirectoryEntry,
  type KindFilter,
  type Listing,
  type Standing,
} from "@/lib/domain/design/connections";
import { newId, query, transaction } from "./db";

const pair = (x: string, y: string) => (x < y ? [x, y] : [y, x]);

/** This business's key, made the first time it is asked for. */
async function keyOf(businessId: string): Promise<string> {
  await query(`insert into design_directory (business_id, key) values ($1, $2) on conflict (business_id) do nothing`, [
    businessId,
    randomBytes(12).toString("hex"),
  ]);
  const rows = await query<{ key: string }>(`select key from design_directory where business_id = $1`, [businessId]);
  return rows[0].key;
}

/** What this business shows in the directory. */
export async function myListing(businessId: string): Promise<Listing> {
  await keyOf(businessId);
  const rows = await query<{ listed: boolean; suburb: string; state: string; abn: string }>(
    `select listed, suburb, state, abn from design_directory where business_id = $1`,
    [businessId],
  );
  const r = rows[0];
  return r ? { listed: r.listed, suburb: r.suburb, state: r.state as AuState | "", abn: r.abn } : NOT_LISTED;
}

export async function saveListing(businessId: string, listing: Listing, by: string): Promise<void> {
  await keyOf(businessId);
  await query(
    `update design_directory set listed = $2, suburb = $3, state = $4, abn = $5, updated_at = now(), updated_by = $6 where business_id = $1`,
    [businessId, listing.listed, listing.suburb, listing.state, listing.abn, by.toLowerCase()],
  );
}

type Row = {
  business_id: string;
  key: string;
  name: string;
  kind: string;
  suburb: string | null;
  state: string | null;
  abn: string | null;
};
const entry = (r: Row): DirectoryEntry => ({
  key: r.key,
  name: r.name,
  kind: cleanKind(r.kind),
  suburb: r.suburb ?? "",
  state: r.state ?? "",
});

/** Where this business stands with each other business it has a connection row with, by the other's id. */
async function standings(businessId: string): Promise<Map<string, { id: string; standing: Standing; since: string }>> {
  const rows = await query<{ id: string; other: string; status: string; asker: string; since: string }>(
    `select id, case when a_business = $1 then b_business else a_business end as other, status, asked_by_business as asker,
            to_char(coalesce(answered_at, created_at) at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as since
       from design_connections where a_business = $1 or b_business = $1`,
    [businessId],
  );
  return new Map(
    rows.map((r) => [
      r.other,
      { id: r.id, since: r.since, standing: r.status === "connected" ? "connected" : r.asker === businessId ? "requested" : "incoming" },
    ]),
  );
}

/** Listed businesses that match a search, not this one, each with where this business stands with it. */
export async function searchDirectory(
  businessId: string,
  q: string,
  kind: KindFilter,
): Promise<(DirectoryEntry & { standing: Standing })[]> {
  const first =
    q
      .trim()
      .split(/\s+/)[0]
      ?.replace(/[%_\\]/g, "") ?? "";
  const digits = q.replace(/\D/g, "");
  const rows = await query<Row & { abn: string }>(
    `select d.business_id, d.key, b.name, b.kind, d.suburb, d.state, d.abn
       from design_directory d join businesses b on b.id = d.business_id
      where d.listed and d.business_id <> $1 and ($2 = 'all' or b.kind = $2)
        and (b.name ilike $3 or d.suburb ilike $3 or d.state ilike $3 or ($4 <> '' and d.abn = $4))
      order by b.name limit 200`,
    [businessId, kind, `%${first}%`, digits.length === 11 ? digits : ""],
  );
  const mine = await standings(businessId);
  return rows
    .filter((r) => matchesSearch({ name: r.name, suburb: r.suburb ?? "", state: r.state ?? "", abn: r.abn }, q))
    .slice(0, MAX_RESULTS)
    .map((r) => ({ ...entry(r), standing: mine.get(r.business_id)?.standing ?? "none" }));
}

export interface ConnectionLine {
  id: string;
  business: DirectoryEntry;
  standing: Exclude<Standing, "none">;
  since: string;
}

/** Every connection and request this business has, the others shown as the directory would show them. */
export async function connectionsOf(businessId: string): Promise<ConnectionLine[]> {
  const mine = await standings(businessId);
  if (!mine.size) return [];
  const ids = [...mine.keys()];
  for (const id of ids) await keyOf(id);
  const rows = await query<Row>(
    `select b.id as business_id, d.key, b.name, b.kind, d.suburb, d.state, d.abn
       from businesses b join design_directory d on d.business_id = b.id where b.id = any($1)`,
    [ids],
  );
  return rows
    .map((r) => {
      const s = mine.get(r.business_id)!;
      return { id: s.id, business: entry(r), standing: s.standing as Exclude<Standing, "none">, since: s.since };
    })
    .sort((a, b) => b.since.localeCompare(a.since));
}

/** How many requests wait for this business to answer. */
export async function incomingCount(businessId: string): Promise<number> {
  const rows = await query<{ n: string }>(
    `select count(*) as n from design_connections where status = 'pending' and asked_by_business <> $1 and (a_business = $1 or b_business = $1)`,
    [businessId],
  );
  return Number(rows[0]?.n ?? 0);
}

/**
 * Asks a listed business to connect. Refused for this business itself, one not listed (or no such key), and when a
 * request or connection is already there. The answer carries who to tell (the other business's owner).
 */
export async function askToConnect(
  member: { businessId: string; email: string },
  key: string,
): Promise<{ ok: true; tell: string | null } | { ok: false; status: number; message: string }> {
  const target = await query<{ business_id: string; owner: string | null }>(
    `select d.business_id, (select m.email from business_members m where m.business_id = d.business_id and m.role = 'owner' limit 1) as owner
       from design_directory d where d.key = $1 and d.listed`,
    [key],
  );
  const t = target[0];
  if (!t) return { ok: false, status: 404, message: "That business isn't in the directory." };
  const standing = (await standings(member.businessId)).get(t.business_id)?.standing ?? "none";
  const refused = requestRefusal(standing, t.business_id === member.businessId);
  if (refused) return { ok: false, status: 409, message: refused };
  const [a, b] = pair(member.businessId, t.business_id);
  const made = await query(
    `insert into design_connections (id, a_business, b_business, asked_by_business, asked_by) values ($1,$2,$3,$4,$5)
     on conflict (a_business, b_business) do nothing returning id`,
    [newId("con"), a, b, member.businessId, member.email.toLowerCase()],
  );
  if (!made.length) return { ok: false, status: 409, message: "You're already connected, or a request is waiting." };
  return { ok: true, tell: t.owner };
}

/**
 * Answers or ends a connection this business is part of: accept or decline a request to it, cancel its own request,
 * or disconnect. Accepting answers with who to tell (the owner of the business that asked).
 */
export async function answerConnection(
  member: { businessId: string; email: string },
  id: string,
  action: "accept" | "decline" | "cancel" | "disconnect",
): Promise<{ ok: true; tell: string | null } | { ok: false; status: number; message: string }> {
  return transaction(async (q) => {
    const rows = await q<{ status: string; asker: string }>(
      `select status, asked_by_business as asker from design_connections where id = $1 and (a_business = $2 or b_business = $2) for update`,
      [id, member.businessId],
    );
    const c = rows[0];
    if (!c) return { ok: false as const, status: 404, message: "That request isn't there any more." };
    const theirs = c.asker !== member.businessId;
    const allowed = action === "disconnect" ? c.status === "connected" : c.status === "pending" && (action === "cancel" ? !theirs : theirs);
    if (!allowed) return { ok: false as const, status: 409, message: "That can't be done to this one." };
    if (action === "accept") {
      await q(`update design_connections set status = 'connected', answered_at = now(), answered_by = $2 where id = $1`, [
        id,
        member.email.toLowerCase(),
      ]);
      const owner = await q<{ email: string }>(`select email from business_members where business_id = $1 and role = 'owner' limit 1`, [
        c.asker,
      ]);
      return { ok: true as const, tell: owner[0]?.email ?? null };
    }
    await q(`delete from design_connections where id = $1`, [id]);
    return { ok: true as const, tell: null };
  });
}

/** Whether two businesses are connected (for the steps that pass jobs between them). */
export async function areConnected(businessId: string, otherId: string): Promise<boolean> {
  const [a, b] = pair(businessId, otherId);
  const rows = await query(`select 1 from design_connections where a_business = $1 and b_business = $2 and status = 'connected'`, [a, b]);
  return rows.length > 0;
}

/** The kind of this business, for the emails. */
export async function kindOf(businessId: string): Promise<BusinessKind> {
  const rows = await query<{ kind: string }>(`select kind from businesses where id = $1`, [businessId]);
  return cleanKind(rows[0]?.kind);
}
