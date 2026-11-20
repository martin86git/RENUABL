/**
 * Server only, for RENUABL staff on /admin (never a business's own screens): every business using the roof designer
 * with its kind, when it was made and how many people are in it. Read only. The one place the designer's tables are
 * read across businesses, so it is kept apart from design-repo.ts, where every function takes a business id first.
 */
import { cleanKind, type BusinessKind } from "@/lib/domain/design/business-kind";
import { query } from "./db";
import { ensureNotBilled } from "./design-not-billed";

export interface DesignBusinessRow {
  id: string;
  name: string;
  kind: BusinessKind;
  /** The day it was made, in Melbourne (YYYY-MM-DD). */
  createdAt: string;
  members: number;
  /** Its owner's email, to tell businesses apart. */
  owner: string | null;
  /** RENUABL doesn't bill it (design-not-billed.ts). */
  notBilled: boolean;
}

export async function listDesignBusinesses(): Promise<DesignBusinessRow[]> {
  await ensureNotBilled();
  const rows = await query<{
    id: string;
    name: string;
    kind: string;
    created_at: string;
    members: number;
    owner: string | null;
    not_billed: boolean;
  }>(
    `select b.id, b.name, b.kind, to_char(b.created_at at time zone 'Australia/Melbourne', 'YYYY-MM-DD') as created_at,
            (select count(*)::int from business_members m where m.business_id = b.id) as members,
            (select m.email from business_members m where m.business_id = b.id and m.role = 'owner' limit 1) as owner,
            b.not_billed_at is not null as not_billed
       from businesses b order by b.created_at desc limit 500`,
  );
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    kind: cleanKind(r.kind),
    createdAt: r.created_at,
    members: r.members,
    owner: r.owner,
    notBilled: r.not_billed,
  }));
}
