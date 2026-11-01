/**
 * Server only. What the database keeps for the roof designer's businesses:
 * the business and its members, its settings, its supplier price lists and
 * its roofs.
 *
 * The rule of this file: every function that touches a business's rows takes
 * that business's id first, and every statement carries `business_id = $1`.
 * The id always comes from the signed-in member (`design-context.ts`), never
 * from the browser, so one business can't reach another's rows even by
 * guessing an id.
 */
import { cleanKind, type BusinessKind } from "@/lib/domain/design/business-kind";
import {
  MAX_MEMBERS,
  MAX_PROJECTS,
  cleanPermissions,
  roofKey,
  type MemberPermissions,
  type ImportRoof,
  type MemberRole,
  type RoofPlace,
  type RoofWork,
  type WorkspaceSettings,
} from "@/lib/domain/design/account";
import { MAX_SUPPLIER_LISTS, type SupplierList } from "@/lib/domain/design/pricing";
import type { DesignExtras } from "@/lib/domain/design/quote";
import { newId, query, transaction } from "./db";
import { linkJobsToRoof } from "./design-crm-repo";

// ---------------------------------------------------------------------------
// Businesses and members
// ---------------------------------------------------------------------------

export interface Member {
  businessId: string;
  businessName: string;
  /** What kind of business it is: it decides what the member's login holds (business-kind.ts); none is a retailer. */
  businessKind?: BusinessKind;
  email: string;
  role: MemberRole;
  /** The version of the terms this person accepted, or null when they haven't yet (someone added by the owner). */
  termsVersion: string | null;
  /** What the owner lets this person do (`can`). The owner's own are never looked at. */
  permissions: MemberPermissions;
  /** Set while the owner is viewing the product as this member (read only): the owner's email. */
  viewedBy?: string;
}

/** The business this email belongs to, if any. An email is in one business at most. */
export async function memberByEmail(email: string): Promise<Member | null> {
  const rows = await query<{
    business_id: string;
    name: string;
    kind: string;
    email: string;
    role: MemberRole;
    terms_version: string | null;
    permissions: unknown;
  }>(
    `select m.business_id, b.name, b.kind, m.email, m.role, m.terms_version, m.permissions
       from business_members m join businesses b on b.id = m.business_id
      where m.email = $1`,
    [email.toLowerCase()],
  );
  const m = rows[0];
  return m
    ? {
        businessId: m.business_id,
        businessName: m.name,
        businessKind: cleanKind(m.kind),
        email: m.email,
        role: m.role,
        termsVersion: m.terms_version,
        permissions: cleanPermissions(m.permissions),
      }
    : null;
}

/**
 * A new business with this person as its owner, their acceptance of the terms
 * recorded with the server's time. Someone already in a business keeps the
 * one they have: nothing is made.
 */
export async function createBusiness(email: string, name: string, termsVersion: string, kind: BusinessKind = "retailer"): Promise<Member> {
  const who = email.toLowerCase();
  await transaction(async (q) => {
    const businessId = newId("biz");
    // The member row goes in first: its unique email is what stops two businesses for one person, even at the same moment.
    await q(`insert into businesses (id, name, created_by, kind) values ($1,$2,$3,$4)`, [businessId, name, who, kind]);
    const made = await q(
      `insert into business_members (id, business_id, email, role, terms_version, terms_accepted_at)
       values ($1,$2,$3,'owner',$4, now()) on conflict (email) do nothing returning id`,
      [newId("mem"), businessId, who, termsVersion],
    );
    if (!made.length) await q(`delete from businesses where id = $1`, [businessId]);
  });
  const member = await memberByEmail(who);
  if (!member) throw new Error("the business couldn't be made");
  return member;
}

/** Records that this member accepted this version of the terms, now. */
export async function acceptTerms(businessId: string, email: string, termsVersion: string): Promise<void> {
  await query(`update business_members set terms_version = $3, terms_accepted_at = now() where business_id = $1 and email = $2`, [
    businessId,
    email.toLowerCase(),
    termsVersion,
  ]);
}

export async function renameBusiness(businessId: string, name: string): Promise<void> {
  await query(`update businesses set name = $2, updated_at = now() where id = $1`, [businessId, name]);
}

export interface MemberLine {
  email: string;
  role: MemberRole;
  /** Whether they have signed in and accepted the terms yet. */
  joined: boolean;
  permissions: MemberPermissions;
}

export async function listMembers(businessId: string): Promise<MemberLine[]> {
  const rows = await query<{ email: string; role: MemberRole; joined: boolean; permissions: unknown }>(
    `select email, role, terms_accepted_at is not null as joined, permissions from business_members
      where business_id = $1 order by (role = 'owner') desc, created_at`,
    [businessId],
  );
  return rows.map((m) => ({ ...m, permissions: cleanPermissions(m.role === "owner" ? null : m.permissions) }));
}

/** Sets what a member may do. Never the owner's (the owner may always do everything). False when there's no such member. */
export async function setPermissions(businessId: string, email: string, permissions: MemberPermissions): Promise<boolean> {
  const rows = await query(
    `update business_members set permissions = $3 where business_id = $1 and email = $2 and role <> 'owner' returning id`,
    [businessId, email.toLowerCase(), JSON.stringify(permissions)],
  );
  return rows.length > 0;
}

/**
 * Adds someone to the business by email: they get in the next time they sign
 * in with that address. "taken" when the email is already in a business (this
 * one or another), "full" at the limit.
 */
export async function addMember(businessId: string, email: string, invitedBy: string): Promise<"added" | "taken" | "full"> {
  return transaction(async (q) => {
    const count = await q<{ n: string }>(`select count(*) as n from business_members where business_id = $1`, [businessId]);
    if (Number(count[0]?.n ?? 0) >= MAX_MEMBERS) return "full";
    const made = await q(
      `insert into business_members (id, business_id, email, role, invited_by) values ($2,$1,$3,'member',$4)
       on conflict (email) do nothing returning id`,
      [businessId, newId("mem"), email.toLowerCase(), invitedBy.toLowerCase()],
    );
    return made.length ? "added" : "taken";
  });
}

/** Gives a member a role (a member or a designer). Never the owner's. False when there's no such member. */
export async function setRole(businessId: string, email: string, role: Exclude<MemberRole, "owner">): Promise<boolean> {
  const rows = await query(`update business_members set role = $3 where business_id = $1 and email = $2 and role <> 'owner' returning id`, [
    businessId,
    email.toLowerCase(),
    role,
  ]);
  return rows.length > 0;
}

/** Takes someone out of the business: their next request is refused. The owner can't be removed. */
export async function removeMember(businessId: string, email: string): Promise<boolean> {
  const rows = await query(`delete from business_members where business_id = $1 and email = $2 and role <> 'owner' returning id`, [
    businessId,
    email.toLowerCase(),
  ]);
  return rows.length > 0;
}

// ---------------------------------------------------------------------------
// Settings and supplier price lists (kept apart: a list can be thousands of rows)
// ---------------------------------------------------------------------------

/** The business's saved settings, or null when it has never saved any. */
export async function loadSettings(businessId: string): Promise<WorkspaceSettings | null> {
  const rows = await query<{ settings: WorkspaceSettings }>(`select settings from design_settings where business_id = $1`, [businessId]);
  return rows[0]?.settings ?? null;
}

export async function saveSettings(businessId: string, settings: WorkspaceSettings, by: string): Promise<void> {
  await query(
    `insert into design_settings (business_id, settings, updated_by) values ($1,$2,$3)
     on conflict (business_id) do update set settings = excluded.settings, updated_by = excluded.updated_by, updated_at = now()`,
    [businessId, JSON.stringify(settings), by.toLowerCase()],
  );
}

/** The business's price lists, newest first. */
export async function loadLists(businessId: string): Promise<SupplierList[]> {
  const rows = await query<{ data: SupplierList }>(
    `select data from design_price_lists where business_id = $1 order by created_at desc, name`,
    [businessId],
  );
  return rows.map((r) => r.data);
}

/** Keeps a price list. One of the same name is replaced, and past the limit the oldest go, as on a device. */
export async function saveList(businessId: string, list: SupplierList, by: string): Promise<void> {
  await transaction(async (q) => {
    await q(
      `insert into design_price_lists (business_id, name, data, uploaded_by) values ($1,$2,$3,$4)
       on conflict (business_id, name) do update set data = excluded.data, uploaded_by = excluded.uploaded_by, created_at = now()`,
      [businessId, list.name, JSON.stringify(list), by.toLowerCase()],
    );
    await q(
      `delete from design_price_lists where business_id = $1 and name in (
         select name from design_price_lists where business_id = $1 order by created_at desc, name offset $2)`,
      [businessId, MAX_SUPPLIER_LISTS],
    );
  });
}

export async function removeList(businessId: string, name: string): Promise<void> {
  await query(`delete from design_price_lists where business_id = $1 and name = $2`, [businessId, name]);
}

// ---------------------------------------------------------------------------
// Roofs
// ---------------------------------------------------------------------------

export interface ProjectRow extends RoofPlace {
  id: string;
  design: Record<string, unknown>;
  extras: DesignExtras;
  /** Goes up by one with every save, so a save made from an out-of-date copy can be told apart. */
  version: number;
  updatedAt: string;
}

const PROJECT = `id, address, lat, lng, design, extras, version, updated_at as "updatedAt"`;

/** The business's roofs, the most recently changed first: where each is, never the drawings. */
export async function listProjects(businessId: string): Promise<(RoofPlace & { id: string; updatedAt: string })[]> {
  return query(
    `select id, address, lat, lng, updated_at as "updatedAt" from design_projects where business_id = $1 order by updated_at desc limit 500`,
    [businessId],
  );
}

/** The business's work on the roof at this place, if it has any. */
export async function projectAt(businessId: string, roof: Pick<RoofPlace, "lat" | "lng">): Promise<ProjectRow | null> {
  const rows = await query<ProjectRow>(`select ${PROJECT} from design_projects where business_id = $1 and roof_key = $2`, [
    businessId,
    roofKey(roof),
  ]);
  return rows[0] ?? null;
}

export async function projectById(businessId: string, id: string): Promise<ProjectRow | null> {
  const rows = await query<ProjectRow>(`select ${PROJECT} from design_projects where business_id = $1 and id = $2`, [businessId, id]);
  return rows[0] ?? null;
}

/**
 * Starts the business's work on a roof. If it already has that roof (two
 * people opened the same address), the one it has is handed back untouched
 * with `existed`, so nothing is overwritten. "full" at the limit. Either way
 * the business's jobs at that roof are joined to the design (`linkJobsToRoof`).
 */
export async function createProject(
  businessId: string,
  roof: RoofPlace,
  work: RoofWork,
  by: string,
): Promise<{ project: ProjectRow; existed: boolean } | "full"> {
  const count = await query<{ n: string }>(`select count(*) as n from design_projects where business_id = $1`, [businessId]);
  if (Number(count[0]?.n ?? 0) >= MAX_PROJECTS) return "full";
  const made = await query<ProjectRow>(
    `insert into design_projects (id, business_id, roof_key, address, lat, lng, design, extras, created_by, updated_by)
     values ($2,$1,$3,$4,$5,$6,$7,$8,$9,$9) on conflict (business_id, roof_key) do nothing returning ${PROJECT}`,
    [
      businessId,
      newId("roof"),
      roofKey(roof),
      roof.address,
      roof.lat,
      roof.lng,
      JSON.stringify(work.design),
      JSON.stringify(work.extras),
      by.toLowerCase(),
    ],
  );
  const existing = made[0] ?? (await projectAt(businessId, roof));
  if (!existing) throw new Error("the roof couldn't be kept");
  await linkJobsToRoof(businessId, roof, by);
  return { project: existing, existed: !made[0] };
}

/**
 * Saves a roof's work over the copy the browser started from. "conflict" when
 * someone else has saved since (the version has moved on): nothing is
 * changed. "missing" when the business has no such roof. A roof brought
 * across from a device arrives without its address (the device never kept
 * one), so the address is filled in by the first save that has it.
 */
export async function saveProject(
  businessId: string,
  id: string,
  version: number,
  work: RoofWork,
  by: string,
  address = "",
): Promise<{ version: number } | "conflict" | "missing"> {
  const rows = await query<{ version: number; lat: number; lng: number }>(
    `update design_projects set design = $4, extras = $5, version = version + 1, updated_by = $6, updated_at = now(),
            address = case when address = '' then $7 else address end
      where business_id = $1 and id = $2 and version = $3 returning version, lat, lng`,
    [businessId, id, version, JSON.stringify(work.design), JSON.stringify(work.extras), by.toLowerCase(), address],
  );
  if (rows[0]) {
    // A job added for this address since the roof was first drawn picks the design up here.
    await linkJobsToRoof(businessId, rows[0], by);
    return { version: rows[0].version };
  }
  return (await projectById(businessId, id)) ? "conflict" : "missing";
}

export async function deleteProject(businessId: string, id: string): Promise<boolean> {
  const rows = await query(`delete from design_projects where business_id = $1 and id = $2 returning id`, [businessId, id]);
  return rows.length > 0;
}

// ---------------------------------------------------------------------------
// Bringing a device's work into the account
// ---------------------------------------------------------------------------

/**
 * Roofs from a device, kept only where the business has no work on that roof
 * yet: nothing already in the account is ever overwritten. Answers with the
 * roofs that were brought across (by their key), so the device can let go of
 * exactly those.
 */
export async function importRoofs(businessId: string, roofs: readonly ImportRoof[], by: string): Promise<string[]> {
  const imported: string[] = [];
  for (const roof of roofs) {
    const made = await createProject(businessId, roof, roof, by);
    if (made === "full") break;
    if (!made.existed) imported.push(roofKey(roof));
  }
  return imported;
}

/**
 * Settings from a device, kept only when the business has saved none and has
 * no price lists: the first person in sets them, and someone joining later
 * never replaces the business's prices with what was on their own computer.
 */
export async function importSettings(businessId: string, settings: WorkspaceSettings, by: string): Promise<boolean> {
  return transaction(async (q) => {
    const lists = await q(`select 1 from design_price_lists where business_id = $1 limit 1`, [businessId]);
    if (lists.length) return false;
    const made = await q(
      `insert into design_settings (business_id, settings, updated_by) values ($1,$2,$3) on conflict (business_id) do nothing returning business_id`,
      [businessId, JSON.stringify(settings), by.toLowerCase()],
    );
    return made.length > 0;
  });
}
