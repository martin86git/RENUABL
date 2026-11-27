/**
 * Server only. A deal's grid connection after the install as its card shows it, and a change to it
 * (domain/design/grid-connection.ts). Read and written only through the deal as the member may see it; the business id
 * comes from the signed-in member.
 */
import type { DealViewer } from "@/lib/domain/design/account";
import { cleanJobInput } from "@/lib/domain/design/crm";
import { installedOn } from "@/lib/domain/design/deal";
import { typedFields } from "@/lib/domain/design/deal-sections";
import {
  gridConnectionView,
  gridRecordLine,
  withGridChange,
  type GridChange,
  type GridConnectionView,
} from "@/lib/domain/design/grid-connection";
import { loadPrefs } from "./design-after-sale-repo";
import { addActivity, jobById, updateJob } from "./design-crm-repo";
import { asBuiltOf } from "./design-job-card-repo";
import { preApprovalFor } from "./design-preapproval";

type Who = { businessId: string; businessName: string; email: string };

/** The view for a deal this member may see, or null. */
export async function gridConnectionFor(member: Who, jobId: string, viewer?: DealViewer): Promise<GridConnectionView | null> {
  const [got, pre, built] = await Promise.all([
    jobById(member.businessId, jobId, viewer),
    preApprovalFor(member, jobId, viewer),
    asBuiltOf(member.businessId, jobId),
  ]);
  if (!got || !pre) return null;
  return gridConnectionView({ pre, typed: got.job.details, stage: got.job.stage, installedOn: installedOn(got.job), built });
}

/** Puts a change on the deal and writes it on its record. Null for a deal that isn't theirs to see. */
export async function changeGridConnection(
  member: Who,
  jobId: string,
  change: GridChange,
  viewer?: DealViewer,
): Promise<{ view: GridConnectionView } | { refused: string } | null> {
  const got = await jobById(member.businessId, jobId, viewer);
  if (!got) return null;
  const fields = typedFields((await loadPrefs(member.businessId)).dealFields);
  const job = await updateJob(
    member.businessId,
    jobId,
    (current) => cleanJobInput({ details: withGridChange(current.details, change) }, current, fields),
    member.email,
  );
  if (!job) return null;
  if ("refused" in job) return job;
  const view = await gridConnectionFor(member, jobId, viewer);
  if (!view) return null;
  const text = gridRecordLine(change, { network: view.network?.name ?? null, retailer: view.retailer });
  if (text) await addActivity(member.businessId, got.customer.id, { kind: "note", jobId, text }, member.email);
  return { view };
}
