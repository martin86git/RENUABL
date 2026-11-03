/**
 * Jobs sent between a retailer and a connected installer, as the screens reach them (domain/design/job-shares.ts).
 */
import type { ShareStatus, SharedJobLine } from "@/lib/domain/design/job-shares";
import type { JobSheet } from "@/lib/domain/design/my-jobs";
import { ask } from "./crm";

const job = (id: string) => `/api/design/jobs/${encodeURIComponent(id)}/share`;
export const loadShare = (jobId: string) => ask<{ share: ShareStatus | null; installers: { key: string; name: string }[] }>(job(jobId));
export const sendToInstaller = (jobId: string, key: string) =>
  ask<{ share: ShareStatus | null }>(job(jobId), { method: "POST", body: { key } });
export const takeJobBack = (jobId: string) => ask<{ share: ShareStatus | null }>(job(jobId), { method: "DELETE" });

const BASE = "/api/design/installer-jobs";
export const loadInstallerJobs = () => ask<{ jobs: SharedJobLine[] }>(BASE);
export const answerInstallerJob = (id: string, action: "accept" | "decline") =>
  ask<{ jobs: SharedJobLine[] }>(BASE, { method: "POST", body: { id, do: action } });
export const openInstallerJob = (id: string) => ask<{ token: string; from: string; person: string }>(`${BASE}/${encodeURIComponent(id)}`);
export const waitingJobs = () => ask<{ waiting: number }>(`${BASE}?count=1`);
/** My Jobs: the jobs waiting for an answer, the accepted ones as job sheets, and the market's today. */
export const loadMyJobs = () => ask<{ jobs: SharedJobLine[]; sheets: JobSheet[]; today: string }>(`${BASE}?sheets=1`);
/** The roof picture of an accepted job, for its sheet. */
export const sheetRoofHref = (id: string) => `${BASE}/${encodeURIComponent(id)}/roof`;
