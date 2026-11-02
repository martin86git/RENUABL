/**
 * A retailer sends a job to a connected installer (1 Nov 2026, Martin: step 3 of the network; installers join free
 * and get their jobs in their own login instead of an emailed link). The retailer picks an installer it is connected
 * with on the job card; the installer sees it in Jobs with the suburb, the day and the system only, and accepts or
 * declines. Accepted, the job's card opens inside the installer's login: the same card as the installer's private
 * link (the day, the address, the customer's name and phone, never their email; the drawings; one thread of notes and
 * photos; the as-built). One job goes to one installer at a time; the retailer can take it back, and a disconnection
 * closes it. Pure, tested.
 */
import { kindLabel } from "./business-kind";

export const SHARE_STATES = ["sent", "accepted", "declined", "withdrawn"] as const;
export type ShareState = (typeof SHARE_STATES)[number];

/** Whether a share still gives the installer the job (waiting for an answer, or accepted). */
export const shareLive = (state: ShareState) => state === "sent" || state === "accepted";

/** The prefix of an installer link made for a connected business rather than an installer on file. */
export const BUSINESS_LINK = "biz:";

/** What the installer sees before accepting: where in words, when, and what; nothing of the customer. */
export interface SharedJobLine {
  id: string;
  /** The retailer, by name. */
  from: string;
  suburb: string;
  installDate: string | null;
  system: string;
  state: ShareState;
  sentAt: string;
}

/** The retailer's view of where the job stands. */
export interface ShareStatus {
  id: string;
  to: string;
  state: ShareState;
  sentAt: string;
  answeredAt: string | null;
}

/** Why a job can't be sent to that installer, or null. */
export function sendRefusal(input: { connected: boolean; kind: string; live: ShareStatus | null }): string | null {
  if (!input.connected) return "You can only send jobs to installers you're connected with.";
  if (input.kind !== "installer") return "Jobs go to installers. Inspectors are nominated by the installer.";
  if (input.live) return `This job is already with ${input.live.to}. Take it back first.`;
  return null;
}

/** Why the installer can't answer a share that way, or null. */
export function answerRefusal(state: ShareState, action: "accept" | "decline"): string | null {
  if (state === "withdrawn") return "The retailer has taken this job back.";
  if (state === "declined") return "You've declined this job.";
  if (state === "accepted" && action === "accept") return "You've already accepted this job.";
  return null;
}

/** "Sent, waiting for Sparks Electrical", "Accepted by …", "Declined by …", "Taken back". */
export function statusWords(s: ShareStatus): string {
  if (s.state === "sent") return `Sent to ${s.to}, waiting for them to accept`;
  if (s.state === "accepted") return `Accepted by ${s.to}`;
  if (s.state === "declined") return `Declined by ${s.to}`;
  return `Taken back from ${s.to}`;
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** To the installer's owner, from RENUABL: who sent it, the suburb and day, and the way to answer. */
export function jobSentEmail(input: { from: string; suburb: string; day: string | null; link: string }) {
  const when = input.day ? ` for ${input.day}` : "";
  return {
    subject: `${input.from} sent you a job in ${input.suburb}`,
    text: `${input.from} (${kindLabel("retailer")}) sent you an installation in ${input.suburb}${when} on RENUABL.\n\nAccept or decline: ${input.link}`,
    html: `<p>${esc(input.from)} sent you an installation in ${esc(input.suburb)}${esc(when)} on RENUABL.</p><p><a href="${esc(input.link)}">Accept or decline</a></p>`,
  };
}

/** To whoever sent it, from RENUABL: the installer's answer. */
export function jobAnsweredEmail(input: { installer: string; accepted: boolean; suburb: string; link: string }) {
  const what = input.accepted ? "accepted" : "declined";
  return {
    subject: `${input.installer} ${what} the job in ${input.suburb}`,
    text: `${input.installer} ${what} the installation in ${input.suburb}.\n\nThe job card: ${input.link}`,
    html: `<p>${esc(input.installer)} ${what} the installation in ${esc(input.suburb)}.</p><p><a href="${esc(input.link)}">The job card</a></p>`,
  };
}
