/**
 * Installer portal service layer. Replace mock reads/writes with API calls.
 */
import type { FieldStatus, Job, JobStage } from "@/lib/domain/types";
import { CREWS, CURRENT_INSTALLER_ID, CURRENT_USER, INSTALLERS } from "@/lib/mock/installers";
import { INSTALLER_PERFORMANCE, RESOURCES, buildJobs, buildPayouts } from "@/lib/mock/jobs";
import { todayInMarket } from "@/lib/domain/market";
import { formatShortDate } from "@/lib/domain/format";
import { jobsToOrderFor } from "@/lib/domain/materials";

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

export function getAlerts() {
  const jobs = listJobs();
  const alerts: { id: string; jobId: string; title: string; detail: string; severity: "warning" | "info" }[] = [];
  for (const j of jobs) {
    if (j.stage === "new") {
      alerts.push({
        id: `${j.id}-new`,
        jobId: j.id,
        title: `New job to review · ${j.reference}`,
        detail: `${j.customer.name}, ${j.address.suburb}`,
        severity: "info",
      });
    }
    const missingApproval = j.documents.find((d) => d.kind === "approval" && d.status === "required");
    if (missingApproval && j.stage !== "new") {
      alerts.push({
        id: `${j.id}-appr`,
        jobId: j.id,
        title: `Network approval outstanding · ${j.reference}`,
        detail: "Submit before scheduling can be confirmed",
        severity: "warning",
      });
    }
    if (j.stage === "accepted") {
      alerts.push({
        id: `${j.id}-crew`,
        jobId: j.id,
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

export function listPayouts() {
  return buildPayouts();
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
