/** Today's deal feed as the screens reach it (/api/design/feed), and the controls on its cards. */
import type { FeedDeal } from "@/lib/domain/design/deal-feed";
import { ask } from "./crm";

export interface FeedAnswer {
  deals: FeedDeal[];
  callsOn: boolean;
  team: { email: string; name: string }[];
  /** How many example deals a made-up business has; null for a real business. */
  examples: number | null;
}

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
