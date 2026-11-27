"use client";

import type { GridChange, GridConnectionView } from "@/lib/domain/design/grid-connection";
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

const gridAt = (jobId: string) => `/api/design/jobs/${encodeURIComponent(jobId)}/grid-connection`;

/** A deal's grid connection after the install as its card shows it. */
export const loadGridConnection = (jobId: string) => ask<{ view: GridConnectionView }>(gridAt(jobId));

/** Fills in what the connection needs, or records where it stands; the Grid connections page is told. */
export async function saveGridConnection(jobId: string, change: GridChange) {
  const res = await ask<{ view: GridConnectionView }>(gridAt(jobId), { method: "POST", body: change });
  if (res.ok) window.dispatchEvent(new Event("renuabl:grid"));
  return res;
}
