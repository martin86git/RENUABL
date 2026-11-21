/**
 * RENUABL's own sales pipeline for RENUABL Business (21 Nov 2026, Martin: "a pipeline dedicated to the Renuabl business
 * as a service provider. so that new Demo requests appear as a deal stage"; kept on /admin, apart from the homeowner
 * deals in RENUABL's CRM, whose stages are a solar job's). A lead is a row of `design_leads` (a demo request, an
 * Enterprise enquiry, or someone who put their details on the self-serve demo); each comes in at the first stage and
 * staff move it on. Pure, tested.
 */

export const BUSINESS_LEAD_STAGES = ["new", "booked", "demoed", "signed-up", "won", "lost"] as const;
export type BusinessLeadStage = (typeof BUSINESS_LEAD_STAGES)[number];

export const STAGE_WORDS: Record<BusinessLeadStage, string> = {
  new: "New",
  booked: "Demo booked",
  demoed: "Demo done",
  "signed-up": "Signed up",
  won: "Won",
  lost: "Lost",
};

/** The kinds of lead that belong in the pipeline. The marketplace waiting list is interest, not a sale, so it stays out. */
export const PIPELINE_KINDS = ["demo-request", "enterprise", "demo"] as const;
export type PipelineKind = (typeof PIPELINE_KINDS)[number];

export const KIND_WORDS: Record<PipelineKind, string> = {
  "demo-request": "Demo request",
  enterprise: "Enterprise enquiry",
  demo: "Tried the demo",
};

export const isPipelineKind = (k: string): k is PipelineKind => (PIPELINE_KINDS as readonly string[]).includes(k);

/** A stage from the browser, or null. */
export const cleanStage = (raw: unknown): BusinessLeadStage | null =>
  typeof raw === "string" && (BUSINESS_LEAD_STAGES as readonly string[]).includes(raw) ? (raw as BusinessLeadStage) : null;

/** A stage read back from the database: anything missing or unknown is New. */
export const stageOf = (raw: string | null | undefined): BusinessLeadStage => cleanStage(raw) ?? "new";

export const STAFF_NOTE_MAX = 1000;

/** Staff's note on a lead: plain text with its lines kept, or "" to clear it. */
export function cleanStaffNote(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  return raw
    .replace(/[\u0000-\u0009\u000b-\u001f\u007f]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, STAFF_NOTE_MAX);
}

export interface BusinessLead {
  id: string;
  kind: PipelineKind;
  email: string;
  name: string | null;
  business: string | null;
  mobile: string | null;
  users: number | null;
  /** What they wrote, as they wrote it. */
  note: string | null;
  stage: BusinessLeadStage;
  staffNote: string | null;
  /** When it came in, and when its stage last moved (ISO). */
  at: string;
  stageAt: string | null;
  movedBy: string | null;
}

/** The board: every stage with its leads, newest first; one email asking twice is two cards, as it came in. */
export function leadBoard(leads: readonly BusinessLead[]): { stage: BusinessLeadStage; leads: BusinessLead[] }[] {
  const newest = [...leads].sort((a, b) => (b.stageAt ?? b.at).localeCompare(a.stageAt ?? a.at));
  return BUSINESS_LEAD_STAGES.map((stage) => ({ stage, leads: newest.filter((l) => l.stage === stage) }));
}

/** How many are still to act on: everything not yet won or lost. */
export const openLeads = (leads: readonly BusinessLead[]) => leads.filter((l) => l.stage !== "won" && l.stage !== "lost").length;
