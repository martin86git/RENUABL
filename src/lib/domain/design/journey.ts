/**
 * The business as one journey (25 Oct 2026, Martin: RENUABL is the end to end solar business tool, and the overview
 * should show that clearly and simply). Every job sits at one stop on the way, from the enquiry to a system running and
 * looked after: enquiries, design and quote, the sale, approvals (grid and rebate), procurement (equipment and
 * installer), the installation, after the install (compliance, grid connection, STCs), systems running, and service.
 * Which stop a job is at is read from its stage and what has been typed on it; nothing is stored. Pure, tested.
 */
import { INSTALLED_STAGES, PRE_INSTALL_STAGES, INSTALLER_KEY, type Job } from "./crm";
import { paperworkDone } from "./deal";

export const JOURNEY = ["enquiries", "design", "sale", "approvals", "procure", "install", "after", "running", "service"] as const;
export type JourneyStop = (typeof JOURNEY)[number];

export const JOURNEY_WORDS: Record<JourneyStop, { name: string; what: string }> = {
  enquiries: { name: "Enquiries", what: "New leads to answer" },
  design: { name: "Design", what: "Roofs to design and quote" },
  sale: { name: "Sale", what: "Proposals waiting to be signed" },
  approvals: { name: "Approvals", what: "Grid and rebate approvals" },
  procure: { name: "Procure", what: "Equipment and installer" },
  install: { name: "Install", what: "Booked and briefed" },
  after: { name: "Post-install", what: "Compliance, grid and STCs" },
  running: { name: "Running", what: "Systems handed over" },
  service: { name: "Service", what: "Customers to look after" },
};

type JourneyJob = Pick<Job, "stage" | "details">;

/** Approvals still open on a sold job: the network hasn't approved it, or a Solar Victoria application is in hand. */
export function approvalsOpen(j: JourneyJob): boolean {
  const grid = j.details.preApproval;
  const gridOpen = !grid || grid === "Not submitted" || grid === "Submitted";
  const rebate = j.details.solarVicStatus;
  return gridOpen || rebate === "Eligibility to check" || rebate === "Applied";
}

/** Where a job is on the journey; null once lost. Service is counted from the service cases, not from a job's stage. */
export function journeyStopOf(j: JourneyJob): Exclude<JourneyStop, "service"> | null {
  if (j.stage === "lead") return "enquiries";
  if (j.stage === "designed") return "design";
  if (j.stage === "proposal") return "sale";
  if (PRE_INSTALL_STAGES.includes(j.stage)) {
    if (approvalsOpen(j)) return "approvals";
    // Equipment and an installer both in hand (ordered, someone named) and it is the installation's turn.
    if (j.stage === "won" || !j.details[INSTALLER_KEY]) return "procure";
    return "install";
  }
  if (INSTALLED_STAGES.includes(j.stage)) return paperworkDone(j) ? "running" : "after";
  return null;
}

export interface JourneyCount {
  stop: JourneyStop;
  name: string;
  what: string;
  count: number;
  href: string;
}

/** Every stop with how many jobs are at it (and, for service, the cases to resolve), in the journey's order. */
export function journey(jobs: readonly JourneyJob[], serviceOpen: number, paths: Record<JourneyStop, string>): JourneyCount[] {
  const counts = Object.fromEntries(JOURNEY.map((s) => [s, 0])) as Record<JourneyStop, number>;
  for (const j of jobs) {
    const at = journeyStopOf(j);
    if (at) counts[at] += 1;
  }
  counts.service = serviceOpen;
  return JOURNEY.map((stop) => ({ stop, ...JOURNEY_WORDS[stop], count: counts[stop], href: paths[stop] }));
}
