/**
 * Wave 5's extras on deals, as the screens ask for them: each deal's clock and temperature (`/api/design/pulse`),
 * when its emails were opened, and the files kept on it.
 */
import type { DealPulse } from "@/lib/domain/design/deal-heat";
import type { MailMark } from "@/lib/domain/design/email-opens";
import { ask, type Answer } from "./crm";

export const loadPulses = () => ask<{ pulses: Record<string, DealPulse> }>("/api/design/pulse");
/** Each deal's mail mark (emails sent from it, and whether the latest was opened), for the pipeline cards. */
export const loadMailMarks = () => ask<{ marks: Record<string, MailMark> }>("/api/design/mail-marks");
export const loadOpens = (jobId: string) => ask<{ opens: Record<string, string[]> }>(`/api/design/jobs/${encodeURIComponent(jobId)}/opens`);

export interface DealFile {
  id: string;
  name: string;
  type: string;
  size: number;
  by: string;
  at: string;
}

export const listDealFiles = (jobId: string) => ask<{ files: DealFile[] }>(`/api/design/jobs/${encodeURIComponent(jobId)}/files`);
export const deleteDealFile = (jobId: string, fileId: string) =>
  ask<object>(`/api/design/jobs/${encodeURIComponent(jobId)}/files/${encodeURIComponent(fileId)}`, { method: "DELETE" });
export const dealFileHref = (jobId: string, fileId: string) =>
  `/api/design/jobs/${encodeURIComponent(jobId)}/files/${encodeURIComponent(fileId)}`;

export async function uploadDealFiles(jobId: string, files: File[]): Promise<Answer<{ files: DealFile[] }>> {
  const form = new FormData();
  for (const f of files) form.append("file", f);
  try {
    const res = await fetch(`/api/design/jobs/${encodeURIComponent(jobId)}/files`, { method: "POST", body: form, cache: "no-store" });
    const json = (await res.json().catch(() => null)) as { ok?: boolean; message?: string; files?: DealFile[] } | null;
    if (res.ok && json?.ok && json.files) return { ok: true, files: json.files };
    return { ok: false, message: json?.message ?? "Those files couldn't be kept just now." };
  } catch {
    return { ok: false, message: "Those files couldn't be kept just now." };
  }
}
