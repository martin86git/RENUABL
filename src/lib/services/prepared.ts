/**
 * Ready for you (domain/design/prepared.ts), as the screens ask for it: the work Sol prepared on the member's deals,
 * and sending or putting it aside. Sending goes through the deal's own email, so it is written on the deal's record as
 * any email is; a follow-up sent is marked done as if emailed by hand.
 */
import type { PreparedItem } from "@/lib/domain/design/prepared";
import { markFollowUp } from "./after-sale";
import { ask, emailDeal } from "./crm";
import { fresh, warm, warmed } from "./warm";

/** Said on the window when something new may be waiting (a call's write-up applied), so the tray looks again. */
export const PREPARED_CHANGED = "renuabl:prepared";

const askPrepared = () => ask<{ items: PreparedItem[] }>("/api/design/prepared");
/** Sol's tray; `again` asks afresh after a change rather than sharing an ask already out. */
export const loadPrepared = (again = false) => (again ? fresh : warm)("prepared", askPrepared);
/** The last tray read this visit, so it opens on it. */
export const keptPrepared = () => warmed<{ ok: true; items: PreparedItem[] }>("prepared");

const close = (id: string, act: "sent" | "dismiss") => ask<object>("/api/design/prepared", { method: "POST", body: { id, do: act } });

export const dismissPrepared = (id: string) => close(id, "dismiss");
/** Takes a draft off the tray as sent, when its email went another way (the composer on Sol's draft: a Cc, or their own Gmail). */
export const markPreparedSent = (id: string) => close(id, "sent");

/** Sends it as the member wrote it (their press), marks the follow-up done, and takes it off the tray. */
export async function sendPrepared(item: PreparedItem, words: { subject: string; body: string }) {
  const sent = await emailDeal(item.jobId, { to: item.to, ...words });
  if (!sent.ok) return sent;
  if (item.kind === "follow-up" && item.day) await markFollowUp(item.jobId, item.day, "email");
  await close(item.id, "sent");
  return sent;
}

/** A call's write-up, applied to its deal in one press (call-notes/apply). */
export const applyCall = (
  jobId: string,
  input: {
    text: string;
    details: Record<string, string>;
    remindDays: number;
    nextStep: string;
    recap: { subject: string; body: string } | null;
  },
) => ask<{ done: string[] }>(`/api/design/jobs/${encodeURIComponent(jobId)}/call-notes/apply`, { method: "POST", body: input });
