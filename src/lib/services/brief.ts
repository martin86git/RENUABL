/** The guided brief's calls to the server: save progress, and book the call. */
import type { BriefAnswers } from "@/lib/domain/brief";

export interface BriefSummaryInput {
  home?: string;
  usage?: string;
  system?: string;
  price?: string;
  rebates?: string;
  installDate?: string;
  billRead?: boolean;
}

export async function saveBrief(key: string, answers: BriefAnswers, summary: BriefSummaryInput): Promise<boolean> {
  try {
    const res = await fetch(`/api/brief/${key}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ answers, summary }),
      keepalive: true,
    });
    return res.ok;
  } catch {
    return false;
  }
}

export interface BriefBookingInput {
  date: string;
  time: string;
  phone: string;
  email?: string;
  answers: BriefAnswers;
  summary: BriefSummaryInput;
  consent: { terms: boolean; marketing: boolean };
  /** Booked from "Don't have time to finish?" before the end. */
  unfinished?: boolean;
}

export async function bookBriefCall(
  key: string,
  input: BriefBookingInput,
): Promise<{ ok: boolean; call?: string; emailed?: boolean; message?: string }> {
  try {
    const res = await fetch(`/api/brief/${key}/book`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
    });
    return (await res.json()) as { ok: boolean; call?: string; emailed?: boolean; message?: string };
  } catch {
    return { ok: false, message: "That didn't send. Check your connection and try again." };
  }
}
