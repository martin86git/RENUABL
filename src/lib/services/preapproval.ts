"use client";

import type { PreApprovalChange, PreApprovalView } from "@/lib/domain/design/preapproval";
import { ask } from "./crm";

const at = (jobId: string) => `/api/design/jobs/${encodeURIComponent(jobId)}/preapproval`;

/** A deal's network pre-approval as its card shows it. */
export const loadPreApproval = (jobId: string) => ask<{ view: PreApprovalView }>(at(jobId));

/** Fills in what the application needs, or records where it stands; the badges on Pre-approvals are told. */
export async function savePreApproval(jobId: string, change: PreApprovalChange) {
  const res = await ask<{ view: PreApprovalView }>(at(jobId), { method: "POST", body: change });
  if (res.ok) window.dispatchEvent(new Event("renuabl:approvals"));
  return res;
}
