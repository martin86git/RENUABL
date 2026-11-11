/** Today's deal feed as the screens reach it (/api/design/feed), and the controls on its cards. */
import type { DayDone, FeedDeal, FeedMark, LaterChoice } from "@/lib/domain/design/deal-feed";
import { ask } from "./crm";

export interface FeedAnswer {
  deals: FeedDeal[];
  callsOn: boolean;
  team: { email: string; name: string; role?: string }[];
  /** How many example deals a made-up business has; null for a real business. */
  examples: number | null;
  /** The day's work beside All clear; null when it couldn't be read. */
  today?: DayDone | null;
  /** The reader's role: the owner opens on everyone's deals, others on their own. */
  role?: "owner" | "member" | "designer";
  /** Who the owner's new leads go to (deal-feed.ts `LeadRule`). */
  leadRule?: "adder" | "turns";
}

/** Who the owner's new leads go to: whoever adds them, or the salespeople in turn (the owner only). */
export const saveLeadRule = (leadRule: "adder" | "turns") =>
  ask<{ leadRule: "adder" | "turns" }>("/api/design/feed", { method: "POST", body: { leadRule } });

export const loadFeed = () => ask<FeedAnswer>("/api/design/feed");
/** Sol writes an email to the deal's customer, as asked: words to change and send, nothing sent. */
export const writeWithSol = (jobId: string, text: string) =>
  ask<{ subject: string; body: string }>(`/api/design/jobs/${encodeURIComponent(jobId)}/write`, { method: "POST", body: { ask: text } });
/** Sol rings the deal's customer, on the number on their record, in calling hours. */
export const solCalls = (jobId: string) =>
  ask<{ message: string }>(`/api/design/jobs/${encodeURIComponent(jobId)}/call`, { method: "POST", body: {} });
/** Adds the example deals to a made-up business, or clears them. */
export const exampleDeals = (what: "add" | "clear") =>
  ask<{ examples: number | null }>("/api/design/examples", { method: "POST", body: { do: what } });
/** Done or Later on a deal's card, or taken off again. */
export const markFeedDeal = (jobId: string, act: "done" | "later" | "undo", o: { later?: LaterChoice; need?: string } = {}) =>
  ask<{ mark: FeedMark | null }>("/api/design/feed", { method: "POST", body: { jobId, do: act, ...o } });
