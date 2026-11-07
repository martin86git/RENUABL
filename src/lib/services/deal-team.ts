/** The team chat on a deal (deal-team.ts), as the screens reach it: `/api/design/jobs/<id>/team`. */
import type { DealLine } from "@/lib/domain/design/deal-team";
import { ask } from "./crm";

export interface DealTeamView {
  jobId: string;
  customer: string;
  lines: DealLine[];
  members: { email: string; name: string; role: string }[];
  me: string;
}

const path = (jobId: string) => `/api/design/jobs/${encodeURIComponent(jobId)}/team`;

export const loadDealTeam = (jobId: string) => ask<DealTeamView>(path(jobId));
/** One of Sol's requests on a deal: the brief the designer shows. */
export const loadDealAsk = (jobId: string, lineId: string) => ask<{ line: DealLine }>(`${path(jobId)}?ask=${encodeURIComponent(lineId)}`);
/** Says something on the deal; "@Sol" in it has him answer there shortly. */
export const sayOnDeal = (jobId: string, text: string) =>
  ask<{ line: DealLine; told: string[]; solAnswering: boolean }>(path(jobId), { method: "POST", body: { text } });
/** Marks one of Sol's requests done, or opens it again. */
export const markAskDone = (jobId: string, lineId: string, done = true) =>
  ask(path(jobId), { method: "POST", body: { done: lineId, ...(done ? {} : { undo: true }) } });

/** Said on the window when a deal's team chat changes, so the feed's pad and the deal's tab follow. */
export const DEAL_TEAM_CHANGED = "renuabl:deal-team";
