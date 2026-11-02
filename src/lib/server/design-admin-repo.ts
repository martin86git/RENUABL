/**
 * Server only, for RENUABL staff on /admin (never a business's own screens): every business using the roof designer
 * with its kind, when it was made and how many people are in it. Read only. The one place the designer's tables are
 * read across businesses, so it is kept apart from design-repo.ts, where every function takes a business id first.
 */
import { cleanKind, type BusinessKind } from "@/lib/domain/design/business-kind";
import { query } from "./db";

export interface DesignBusinessRow {
  id: string;
  name: string;
  kind: BusinessKind;
  /** The day it was made, in Melbourne (YYYY-MM-DD). */
  createdAt: string;
  members: number;
}

export async function listDesignBusinesses(): Promise<DesignBusinessRow[]> {
  const rows = await query<{ id: string; name: string; kind: string; created_at: string; members: number }>(
    `select b.id, b.name, b.kind, to_char(b.created_at at time zone 'Australia/Melbourne', 'YYYY-MM-DD') as created_at,
            (select count(*)::int from business_members m where m.business_id = b.id) as members
       from businesses b order by b.created_at desc limit 500`,
  );
  return rows.map((r) => ({ id: r.id, name: r.name, kind: cleanKind(r.kind), createdAt: r.created_at, members: r.members }));
}
