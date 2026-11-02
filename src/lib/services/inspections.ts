/**
 * Inspections an installer nominates, as the screens reach them (domain/design/inspections.ts).
 */
import type { InspectionLine, InspectionView, Outcome } from "@/lib/domain/design/inspections";
import type { JobCardView } from "@/lib/server/design-job-card-repo";
import { ask } from "./crm";

const share = (id: string) => `/api/design/installer-jobs/${encodeURIComponent(id)}/inspection`;
export const loadNomination = (shareId: string) =>
  ask<{ inspection: InspectionView | null; inspectors: { key: string; name: string }[] }>(share(shareId));
export const nominateInspector = (shareId: string, key: string) =>
  ask<{ inspection: InspectionView | null }>(share(shareId), { method: "POST", body: { key } });
export const takeNominationBack = (shareId: string) => ask<{ inspection: InspectionView | null }>(share(shareId), { method: "DELETE" });

export const jobInspection = (jobId: string) =>
  ask<{ inspection: InspectionView | null }>(`/api/design/jobs/${encodeURIComponent(jobId)}/inspection`);

const BASE = "/api/design/inspections";
const one = (id: string) => `${BASE}/${encodeURIComponent(id)}`;
export const loadInspections = () => ask<{ inspections: InspectionLine[] }>(BASE);
export const nominatedInspections = () => ask<{ nominated: number }>(`${BASE}?count=1`);
export const loadInspection = (id: string) => ask<{ card: JobCardView; inspection: InspectionView }>(one(id));
export const declineInspection = (id: string) => ask<object>(one(id), { method: "POST", body: { do: "decline" } });
export const inspectionFileHref = (id: string, fileId: string) => `${one(id)}/files/${encodeURIComponent(fileId)}`;
export const inspectionRoofHref = (id: string) => `${one(id)}/roof`;
export const certificateHref = (id: string) => `${one(id)}/certificate`;

/** Records where the inspection stands, with the certificate when one is chosen (sent as a form). */
export async function recordInspection(
  id: string,
  outcome: { state: Outcome; on: string; notes: string },
  certificate: File | null,
): Promise<{ ok: true; card: JobCardView; inspection: InspectionView } | { ok: false; message: string }> {
  const form = new FormData();
  form.set("state", outcome.state);
  form.set("on", outcome.on);
  form.set("notes", outcome.notes);
  if (certificate) form.set("certificate", certificate);
  try {
    const res = await fetch(one(id), { method: "POST", body: form, cache: "no-store" });
    const json = (await res.json().catch(() => null)) as {
      ok?: boolean;
      message?: string;
      card?: JobCardView;
      inspection?: InspectionView;
    } | null;
    if (res.ok && json?.ok && json.card && json.inspection) return { ok: true, card: json.card, inspection: json.inspection };
    return { ok: false, message: json?.message ?? "We couldn't save that just now. Try again in a moment." };
  } catch {
    return { ok: false, message: "We couldn't save that just now. Try again in a moment." };
  }
}
