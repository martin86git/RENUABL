/**
 * Server only. RENUABL Business's own sales pipeline, for staff on /admin (domain/design/business-leads.ts): the sales
 * leads in `design_leads` that are a sale (demo requests, Enterprise enquiries, demo sign-ups), each with its stage, who
 * moved it and staff's note. Staff only: this reads across every lead, so nothing here is reached by a business.
 */
import { PIPELINE_KINDS, stageOf, type BusinessLead, type BusinessLeadStage, type PipelineKind } from "@/lib/domain/design/business-leads";
import { query } from "./db";

interface Row {
  id: string;
  kind: string;
  email: string;
  name: string | null;
  business: string | null;
  mobile: string | null;
  users: number | null;
  note: string | null;
  stage: string | null;
  staff_note: string | null;
  at: Date;
  stage_at: Date | null;
  moved_by: string | null;
}

/** Every lead in the pipeline, newest first (up to 300: won and lost ones from long ago stay in the table). */
export async function listBusinessLeads(): Promise<BusinessLead[]> {
  const rows = await query<Row>(
    `select id, kind, email, name, business, mobile, users, note, stage, staff_note, at, stage_at, moved_by
       from design_leads where kind = any($1) order by coalesce(stage_at, at) desc limit 300`,
    [PIPELINE_KINDS],
  );
  return rows.map((r) => ({
    id: r.id,
    kind: r.kind as PipelineKind,
    email: r.email,
    name: r.name,
    business: r.business,
    mobile: r.mobile,
    users: r.users,
    note: r.note,
    stage: stageOf(r.stage),
    staffNote: r.staff_note,
    at: new Date(r.at).toISOString(),
    stageAt: r.stage_at ? new Date(r.stage_at).toISOString() : null,
    movedBy: r.moved_by,
  }));
}

/** Moves a lead to a stage; false when there is no such lead in the pipeline. */
export async function moveBusinessLead(id: string, stage: BusinessLeadStage, by: string): Promise<boolean> {
  const rows = await query(
    `update design_leads set stage = $2, stage_at = now(), moved_by = lower($3) where id = $1 and kind = any($4) returning id`,
    [id, stage, by, PIPELINE_KINDS],
  );
  return rows.length > 0;
}

/** Keeps staff's note on a lead ("" clears it); false when there is no such lead in the pipeline. */
export async function noteBusinessLead(id: string, note: string): Promise<boolean> {
  const rows = await query(`update design_leads set staff_note = nullif($2, '') where id = $1 and kind = any($3) returning id`, [
    id,
    note,
    PIPELINE_KINDS,
  ]);
  return rows.length > 0;
}
