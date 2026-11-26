/**
 * Server only. A deal's network pre-approval as the card shows it, and a change to it (domain/design/preapproval.ts).
 * Read and written only through the deal as the member may see it; the business id comes from the signed-in member.
 */
import type { DealViewer } from "@/lib/domain/design/account";
import { cleanJobInput } from "@/lib/domain/design/crm";
import { systemDetails } from "@/lib/domain/design/deal";
import { typedFields } from "@/lib/domain/design/deal-sections";
import {
  changeRecordLine,
  preApprovalView,
  withPreApprovalChange,
  type PreApprovalChange,
  type PreApprovalView,
} from "@/lib/domain/design/preapproval";
import { loadPrefs } from "./design-after-sale-repo";
import { addActivity, jobById, updateJob } from "./design-crm-repo";
import { chosenDesign } from "./design-job-card-repo";
import { NO_DESIGN, savedFor } from "./design-proposal-repo";

type Who = { businessId: string; businessName: string; email: string };

/** The view for a deal this member may see, or null. The system is what was typed, else the design signed for (or the primary). */
export async function preApprovalFor(member: Who, jobId: string, viewer?: DealViewer): Promise<PreApprovalView | null> {
  const got = await jobById(member.businessId, jobId, viewer);
  if (!got) return null;
  const { job, customer } = got;
  const saved = await savedFor(member.businessId, member.businessName, job.id);
  const set = saved && saved !== NO_DESIGN ? saved.project.set : null;
  const design = set ? await chosenDesign(member.businessId, job.id, set.designs, set.primary) : null;
  const at = design && set ? set.designs.indexOf(design) : -1;
  const form = at >= 0 && saved && saved !== NO_DESIGN ? (saved.project.extras.quotes[at]?.form ?? null) : null;
  const details: Record<string, string> = { ...job.details };
  for (const d of systemDetails(design, form, job.details)) if (d.value && d.value.trim() !== "--") details[d.key] = d.value;
  return preApprovalView({
    jobId: job.id,
    customer: customer.name,
    address: job.address || customer.address || "",
    phone: customer.phone,
    email: customer.email,
    kw: job.kw,
    typed: job.details,
    details,
  });
}

/** Puts a change on the deal and writes it on its record. Null for a deal that isn't theirs to see. */
export async function changePreApproval(
  member: Who,
  jobId: string,
  change: PreApprovalChange,
  viewer?: DealViewer,
): Promise<{ view: PreApprovalView } | { refused: string } | null> {
  const got = await jobById(member.businessId, jobId, viewer);
  if (!got) return null;
  const fields = typedFields((await loadPrefs(member.businessId)).dealFields);
  const job = await updateJob(
    member.businessId,
    jobId,
    (current) =>
      cleanJobInput(
        { details: withPreApprovalChange({ details: current.details, address: current.address || got.customer.address || "" }, change) },
        current,
        fields,
      ),
    member.email,
  );
  if (!job) return null;
  if ("refused" in job) return job;
  const view = await preApprovalFor(member, jobId, viewer);
  if (!view) return null;
  const text = changeRecordLine(change, view.network?.name ?? null);
  if (text) await addActivity(member.businessId, got.customer.id, { kind: "note", jobId, text }, member.email);
  return { view };
}
