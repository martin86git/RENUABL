/** The team chat on a deal (deal-team.ts), as the screens reach it: `/api/design/jobs/<id>/team`. */
import type { DealChatLine, DealLine } from "@/lib/domain/design/deal-team";
import { ask } from "./crm";

export interface DealTeamView {
  jobId: string;
  customer: string;
  title: string;
  /** Whether this member follows it (it lists in their team chat window and counts there). */
  following: boolean;
  lines: DealLine[];
  members: { email: string; name: string; role: string }[];
  me: string;
}

const path = (jobId: string) => `/api/design/jobs/${encodeURIComponent(jobId)}/team`;

/** A deal's chat; `seen` when it is on screen in full, which reads it. */
export const loadDealTeam = (jobId: string, seen = false) => ask<DealTeamView>(`${path(jobId)}${seen ? "?seen=1" : ""}`);
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

/** The deal chats this member follows, for the team chat window's Deals section. */
export const loadDealChats = () => ask<{ deals: DealChatLine[]; unread: number }>("/api/design/team?deals=1");
/** Follows a deal's chat, or stops. */
export const followDealChat = (jobId: string, follow: boolean) =>
  ask<{ following: boolean }>(path(jobId), { method: "POST", body: { follow } });
/** Opens a deal's chat from the team chat window: it joins their Deals section, and is read. */
export const openDealChat = (jobId: string) => ask(path(jobId), { method: "POST", body: { open: true } });
