/**
 * Installer portal service layer. Replace mock reads/writes with API calls.
 */
import type { FieldStatus, Job, JobStage } from "@/lib/domain/types";
import { CREWS, CURRENT_INSTALLER_ID, CURRENT_USER, INSTALLERS } from "@/lib/mock/installers";
import { INSTALLER_PERFORMANCE, RESOURCES, buildJobs } from "@/lib/mock/jobs";
import { jobPayout, type Payout } from "@/lib/domain/payouts";
import type { Variation } from "@/lib/domain/variations";
import { todayInMarket } from "@/lib/domain/market";
import { formatShortDate } from "@/lib/domain/format";
import { jobsToOrderFor } from "@/lib/domain/materials";
import { COMPLIANCE_ITEMS, complianceStatus, expiryPhrase, offersPaused } from "@/lib/domain/compliance";

export function getCurrentInstaller() {
  return INSTALLERS.find((i) => i.id === CURRENT_INSTALLER_ID)!;
}

export function getCurrentUser() {
  return CURRENT_USER;
}

export function listJobs(stage?: JobStage): Job[] {
  const all = buildJobs();
  const jobs = stage ? all.filter((j) => j.stage === stage) : all;
  return [...jobs].sort((a, b) => a.preferredDate.localeCompare(b.preferredDate));
}

export function getJob(id: string): Job | undefined {
  return buildJobs().find((j) => j.id === id);
}

export function listTodaysJobs(now = new Date()): Job[] {
  const today = todayInMarket(now);
  return listJobs().filter((j) => j.preferredDate === today || j.stage === "in-progress");
}

/** Accepted and scheduled jobs installing in the next `days` days, for the materials order. */
export function listJobsToOrder(days: number, now = new Date()): Job[] {
  return jobsToOrderFor(listJobs(), todayInMarket(now), days);
}

export function listCrews() {
  return CREWS;
}

export function getDashboardCounts() {
  const jobs = listJobs();
  return {
    newJobs: jobs.filter((j) => j.stage === "new").length,
    awaitingConfirmation: jobs.filter((j) => j.stage === "new" || j.stage === "accepted").length,
    upcoming: jobs.filter((j) => j.stage === "scheduled").length,
    awaitingAction: jobs.filter(
      (j) => j.stage === "new" || j.stage === "accepted" || j.documents.some((d) => d.status === "required" && d.kind === "approval"),
    ).length,
    completedThisMonth: INSTALLER_PERFORMANCE.jobsCompletedThisMonth,
    rating: INSTALLER_PERFORMANCE.customerRating,
  };
}

/** The partner's licences and insurance, and whether new offers are paused. */
export function getCompliance(now = new Date()) {
  const today = todayInMarket(now);
  const records = getCurrentInstaller().compliance ?? [];
  const items = COMPLIANCE_ITEMS.map((item) => {
    const record = records.find((r) => r.kind === item.kind);
    const status = complianceStatus(record, today);
    return { ...item, record, status, phrase: record ? expiryPhrase(record.expires, today) : "not on file" };
  });
  return { items, ...offersPaused(records, today), attention: items.filter((i) => i.status !== "current") };
}

export function getAlerts() {
  const jobs = listJobs();
  const alerts: { id: string; href: string; title: string; detail: string; severity: "warning" | "info" }[] = [];
  for (const c of getCompliance().attention) {
    alerts.push({
      id: `compliance-${c.kind}`,
      href: "/installer/compliance",
      title: `${c.label} ${c.phrase}`,
      detail: c.status === "expiring" ? "Upload the renewal so job offers keep coming" : "New job offers are paused until it's updated",
      severity: "warning",
    });
  }
  for (const j of jobs) {
    if (j.stage === "new") {
      alerts.push({
        id: `${j.id}-new`,
        href: `/installer/jobs/${j.id}`,
        title: `New job to review · ${j.reference}`,
        detail: `${j.customer.name}, ${j.address.suburb}`,
        severity: "info",
      });
    }
    const missingApproval = j.documents.find((d) => d.kind === "approval" && d.status === "required");
    if (missingApproval && j.stage !== "new") {
      alerts.push({
        id: `${j.id}-appr`,
        href: `/installer/jobs/${j.id}`,
        title: `Network approval outstanding · ${j.reference}`,
        detail: "Submit before scheduling can be confirmed",
        severity: "warning",
      });
    }
    if (j.stage === "accepted") {
      alerts.push({
        id: `${j.id}-crew`,
        href: `/installer/jobs/${j.id}`,
        title: `Assign a crew · ${j.reference}`,
        detail: `${j.customer.name} is booked for ${formatShortDate(j.preferredDate)}`,
        severity: "warning",
      });
    }
  }
  return alerts;
}

export function getPerformance() {
  return INSTALLER_PERFORMANCE;
}

/** Payouts for the partner's jobs: installation at their rates plus approved variations (by record key). */
export function listPartnerPayouts(variations: Record<string, Variation[]> = {}, now = new Date()): Payout[] {
  const partner = getCurrentInstaller();
  const today = todayInMarket(now);
  return listJobs()
    .filter((j) => j.stage !== "new")
    .map((j) => jobPayout(j, { pricing: partner.pricing, variations: variations[j.recordKey], today }))
    .sort((a, b) => b.date.localeCompare(a.date));
}

export function getPartnerPayout(id: string, variations: Variation[] = [], now = new Date()): Payout | null {
  const job = getJob(id);
  if (!job || job.stage === "new") return null;
  return jobPayout(job, { pricing: getCurrentInstaller().pricing, variations, today: todayInMarket(now) });
}

export function listResources() {
  return RESOURCES;
}

export function listCustomers() {
  return listJobs().map((j) => ({
    id: j.id,
    name: j.customer.name,
    suburb: j.address.suburb,
    phone: j.customer.phone,
    stage: j.stage,
    reference: j.reference,
  }));
}

export function listConversations() {
  return listJobs()
    .filter((j) => j.messages.length > 0)
    .map((j) => ({ jobId: j.id, reference: j.reference, customer: j.customer.name, last: j.messages[j.messages.length - 1] }));
}

export async function updateJobStatus(jobId: string, status: FieldStatus, at: string) {
  await new Promise((r) => setTimeout(r, 400));
  return { jobId, status, at, customerNotified: status === "en-route" || status === "on-site" || status === "complete" };
}
