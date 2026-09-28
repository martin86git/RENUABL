/**
 * Installer portal service layer (server only). A signed-in partner sees only
 * their own jobs and offers, from the database; in preview, the sample portal
 * uses mock data. Every read goes through the portal context.
 */
import { redirect } from "next/navigation";
import { COMPLIANCE_ITEMS, complianceStatus, expiryPhrase, offersPaused } from "@/lib/domain/compliance";
import { formatShortDate } from "@/lib/domain/format";
import { portalJob } from "@/lib/domain/jobs";
import { todayInMarket } from "@/lib/domain/market";
import { jobsToOrderFor } from "@/lib/domain/materials";
import { timeLeft } from "@/lib/domain/offers";
import { jobPayout, type Payout } from "@/lib/domain/payouts";
import type { Crew, Installer, Job, JobStage } from "@/lib/domain/types";
import type { Variation } from "@/lib/domain/variations";
import { CREWS, CURRENT_INSTALLER_ID, CURRENT_USER, INSTALLERS } from "@/lib/mock/installers";
import { INSTALLER_PERFORMANCE, RESOURCES, buildJobs } from "@/lib/mock/jobs";
import { jobAddressForPartner, jobsForPartner, obstructionsFor } from "@/lib/server/jobs-repo";
import type { ObstructionCheck } from "@/lib/domain/obstructions";
import { roofInsights } from "@/lib/server/google-solar";
import { SAMPLE_ROOF_ADDRESS, sampleRoofLocation } from "@/lib/server/sample-roof";
import { mapTilesKey } from "@/lib/server/map-tiles";
import type { PlacedPanel } from "@/lib/domain/panel-plan";
import { dailyForecast } from "@/lib/server/google-weather";
import type { RoofInsights } from "@/lib/domain/solar-roof";
import { FORECAST_DAYS, forecastFor, installOutlook, type DayForecast, type Outlook } from "@/lib/domain/weather";
import { daysUntil } from "@/lib/domain/compliance";
import { processOffersSoon } from "@/lib/server/offers-engine";
import { partnerAsInstaller } from "@/lib/server/partners-repo";
import { portalContext, type PortalContext } from "@/lib/server/portal";

/** The portal's context, or off to sign in. */
export async function requirePortal(): Promise<PortalContext> {
  const ctx = await portalContext();
  if (!ctx) redirect("/login?as=partner");
  return ctx;
}

export async function isDemo() {
  return (await requirePortal()).kind === "demo";
}

export async function getCurrentInstaller(): Promise<Installer> {
  const ctx = await requirePortal();
  return ctx.kind === "partner" ? partnerAsInstaller(ctx.partner) : INSTALLERS.find((i) => i.id === CURRENT_INSTALLER_ID)!;
}

export async function getCurrentUser(): Promise<{ name: string; firstName: string }> {
  const ctx = await requirePortal();
  if (ctx.kind === "demo") return CURRENT_USER;
  return { name: ctx.partner.full_name, firstName: ctx.partner.full_name.split(" ")[0] };
}

async function allJobs(): Promise<Job[]> {
  const ctx = await requirePortal();
  if (ctx.kind === "demo") return buildJobs();
  await processOffersSoon();
  const rows = await jobsForPartner(ctx.partner.id);
  return rows.map(({ job, offer }) =>
    portalJob(job, offer?.expires_at ? { id: offer.id, expiresAt: new Date(offer.expires_at).toISOString() } : undefined),
  );
}

export async function listJobs(stage?: JobStage): Promise<Job[]> {
  const all = await allJobs();
  const jobs = stage ? all.filter((j) => j.stage === stage) : all;
  return [...jobs].sort((a, b) => a.preferredDate.localeCompare(b.preferredDate));
}

export async function getJob(id: string): Promise<Job | undefined> {
  return (await allJobs()).find((j) => j.id === id);
}

export interface JobConditions {
  roof: RoofInsights | null;
  /** The install day's forecast, once it's within ten days. */
  forecast: DayForecast | null;
  outlook: { outlook: Outlook; reasons: string[] } | null;
  daysAway: number;
}

/**
 * The job's roof (Google Solar API) and install-day weather (Google Weather
 * API), for a real job that's this partner's or offered to them. Null for the
 * sample portal or a home without coordinates.
 */
export async function getJobConditions(job: Job, now = new Date()): Promise<JobConditions | null> {
  const ctx = await requirePortal();
  if (ctx.kind !== "partner" || !process.env.GOOGLE_MAPS_API_KEY?.trim()) return null;
  const address = await jobAddressForPartner(ctx.partner.id, job.id).catch(() => null);
  if (typeof address?.lat !== "number" || typeof address.lng !== "number") return null;
  const daysAway = daysUntil(job.preferredDate, todayInMarket(now));
  const [roof, days] = await Promise.all([
    roofInsights(address.lat, address.lng).catch(() => null),
    daysAway >= 0 && daysAway < FORECAST_DAYS ? dailyForecast(address.lat, address.lng) : Promise.resolve([]),
  ]);
  const forecast = forecastFor(days, job.preferredDate);
  return { roof, forecast, outlook: forecast ? installOutlook(forecast) : null, daysAway };
}

export interface JobDesign {
  centre: { lat: number; lng: number };
  imageSrc: string;
  /** The panels the partner placed and saved, or null (not saved yet: start empty). */
  plan: PlacedPanel[] | null;
  /** The last roof obstruction check, if one was run. */
  obstructions: ObstructionCheck | null;
  /** The roof check can run (ANTHROPIC_API_KEY is set). */
  canCheck: boolean;
  /** The 3D house view is set up (GOOGLE_MAP_TILES_KEY). */
  can3d: boolean;
  /** The sample portal: a real sample home, and layouts aren't saved. */
  sample?: string;
}

/**
 * The panel layout for the partner's own accepted job: Google's roof model, the
 * satellite image and any saved layout. Null for offers, the sample portal, or
 * homes Google has no roof model for.
 */
export async function getJobDesign(job: Job): Promise<JobDesign | null> {
  const ctx = await requirePortal();
  if (job.offer || !process.env.GOOGLE_MAPS_API_KEY?.trim()) return null;
  if (ctx.kind === "demo") {
    // The sample portal designs on a real home, so the tab can be tried.
    const at = await sampleRoofLocation();
    if (!at) return null;
    return {
      centre: at,
      imageSrc: `/api/roof/image?lat=${at.lat.toFixed(6)}&lng=${at.lng.toFixed(6)}`,
      plan: null,
      obstructions: null,
      canCheck: false,
      can3d: false,
      sample: SAMPLE_ROOF_ADDRESS,
    };
  }
  const address = await jobAddressForPartner(ctx.partner.id, job.id).catch(() => null);
  if (typeof address?.lat !== "number" || typeof address.lng !== "number") return null;
  return {
    centre: { lat: address.lat, lng: address.lng },
    imageSrc: `/api/jobs/${job.recordKey}/roof?size=design`,
    plan: job.layout?.panels ?? null,
    obstructions: ((await obstructionsFor(job.recordKey).catch(() => null)) as ObstructionCheck | null) ?? null,
    canCheck: Boolean(process.env.ANTHROPIC_API_KEY?.trim()),
    can3d: Boolean(mapTilesKey()),
  };
}

export async function listTodaysJobs(now = new Date()): Promise<Job[]> {
  const today = todayInMarket(now);
  return (await listJobs()).filter((j) => j.preferredDate === today || j.stage === "in-progress");
}

/** Accepted and scheduled jobs installing in the next `days` days, for the materials order. */
export async function listJobsToOrder(days: number, now = new Date()): Promise<Job[]> {
  return jobsToOrderFor(await listJobs(), todayInMarket(now), days);
}

export async function listCrews(): Promise<Crew[]> {
  return (await isDemo()) ? CREWS : [];
}

export async function getDashboardCounts() {
  const jobs = await listJobs();
  const demo = await isDemo();
  const month = todayInMarket().slice(0, 7);
  return {
    newJobs: jobs.filter((j) => j.stage === "new").length,
    awaitingConfirmation: jobs.filter((j) => j.stage === "new" || j.stage === "accepted").length,
    upcoming: jobs.filter((j) => j.stage === "scheduled").length,
    awaitingAction: jobs.filter(
      (j) => j.stage === "new" || j.stage === "accepted" || j.documents.some((d) => d.status === "required" && d.kind === "approval"),
    ).length,
    completedThisMonth: demo
      ? INSTALLER_PERFORMANCE.jobsCompletedThisMonth
      : jobs.filter((j) => j.stage === "completed" && j.preferredDate.startsWith(month)).length,
    /** Only the sample portal has a rating; real ones come once customers review their installs. */
    rating: demo ? INSTALLER_PERFORMANCE.customerRating : null,
  };
}

/** The partner's licences and insurance, and whether new offers are paused. */
export async function getCompliance(now = new Date()) {
  const today = todayInMarket(now);
  const records = (await getCurrentInstaller()).compliance ?? [];
  const items = COMPLIANCE_ITEMS.map((item) => {
    const record = records.find((r) => r.kind === item.kind);
    const status = complianceStatus(record, today);
    return { ...item, record, status, phrase: !record ? "not on file" : record.expires ? expiryPhrase(record.expires, today) : "on file" };
  });
  return { items, ...offersPaused(records, today), attention: items.filter((i) => i.status !== "current") };
}

export async function getAlerts() {
  const jobs = await listJobs();
  const alerts: { id: string; href: string; title: string; detail: string; severity: "warning" | "info" }[] = [];
  for (const c of (await getCompliance()).attention) {
    alerts.push({
      id: `compliance-${c.kind}`,
      href: "/installer/compliance",
      title: `${c.label} ${c.phrase}`,
      detail: c.status === "expiring" ? "Upload the renewal so job offers keep coming" : "New job offers are paused until it's updated",
      severity: "warning",
    });
  }
  for (const j of jobs.filter((x) => (x.stage === "accepted" || x.stage === "scheduled") && !x.offer)) {
    const c = await getJobConditions(j);
    if (c?.outlook?.outlook === "risky") {
      alerts.push({
        id: `${j.id}-weather`,
        href: `/installer/jobs/${j.id}`,
        title: `Weather risk on install day · ${j.reference}`,
        detail: `${c.outlook.reasons.join(", ")} forecast. Let the customer know early if it needs to move.`,
        severity: "warning",
      });
    }
  }
  for (const j of jobs) {
    if (j.stage === "new") {
      alerts.push({
        id: `${j.id}-new`,
        href: `/installer/jobs/${j.id}`,
        title: j.offer ? `New job offer · ${j.address.suburb}` : `New job to review · ${j.reference}`,
        detail: j.offer ? `${j.packageName} · ${timeLeft(j.offer.expiresAt).label} to accept` : `${j.customer.name}, ${j.address.suburb}`,
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

/** Sample figures in the demo; real partners' figures build up from their completed jobs. */
export async function getPerformance() {
  return (await isDemo()) ? INSTALLER_PERFORMANCE : null;
}

/** Payouts for the partner's jobs: installation at their rates plus approved variations (by record key). */
export async function listPartnerPayouts(variations: Record<string, Variation[]> = {}, now = new Date()): Promise<Payout[]> {
  const partner = await getCurrentInstaller();
  const today = todayInMarket(now);
  return (await listJobs())
    .filter((j) => j.stage !== "new")
    .map((j) => jobPayout(j, { pricing: partner.pricing, variations: variations[j.recordKey], today }))
    .sort((a, b) => b.date.localeCompare(a.date));
}

export async function getPartnerPayout(id: string, variations: Variation[] = [], now = new Date()): Promise<Payout | null> {
  const job = await getJob(id);
  if (!job || job.stage === "new") return null;
  return jobPayout(job, { pricing: (await getCurrentInstaller()).pricing, variations, today: todayInMarket(now) });
}

export async function listResources() {
  return RESOURCES;
}

export async function listCustomers() {
  return (await listJobs())
    .filter((j) => j.stage !== "new")
    .map((j) => ({
      id: j.id,
      name: j.customer.name,
      suburb: j.address.suburb,
      phone: j.customer.phone,
      stage: j.stage,
      reference: j.reference,
    }));
}

export async function listConversations() {
  return (await listJobs())
    .filter((j) => j.messages.length > 0)
    .map((j) => ({ jobId: j.id, reference: j.reference, customer: j.customer.name, last: j.messages[j.messages.length - 1] }));
}
