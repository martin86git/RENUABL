/**
 * Jobs: every job in one place, by where it is in its life (10 Nov 2026, Martin, folding CRM, Procurement and
 * Installation into one menu item). Five stages a job passes through, each with the quick filters that were separate
 * pages before (Pre-approvals, Solar Victoria, Book an installation, After install), and each job's next step in
 * words. Read from each job's stage, install date and details; nothing is stored. Pure, tested.
 */
import { addDaysISO } from "../scheduling";
import type { ISODate } from "../types";
import { gateOf, preApprovalOf, solarVicOf } from "./approvals";
import { INSTALLED_STAGES, OPEN_STAGES, PRE_INSTALL_STAGES, STAGE_LABELS, type Job, type JobStage } from "./crm";
import { AFTER_STEP_WORDS, nextAfterStep } from "./deal";

export type JobPhase = "selling" | "ready" | "installing" | "finishing" | "done";

export const JOB_PHASES: { id: JobPhase; label: string; what: string }[] = [
  { id: "selling", label: "Selling", what: "Leads, designs and proposals out." },
  { id: "ready", label: "Getting ready", what: "Sold: approvals, stock and the install day." },
  { id: "installing", label: "Installing", what: "On the roof within the week, or due and not marked installed." },
  { id: "finishing", label: "Finishing", what: "Installed: invoice, CoES, STCs and the grid connection." },
  { id: "done", label: "Done", what: "Installed and every step after it done." },
];

/** A sold job with its install day this many days away or sooner is Installing, not Getting ready. */
export const INSTALLING_DAYS = 7;

type PhaseJob = Pick<Job, "stage" | "installDate" | "details">;

/** Where a job is in its life, or null for a lost one. */
export function phaseOf(j: PhaseJob, today: ISODate): JobPhase | null {
  if (OPEN_STAGES.includes(j.stage)) return "selling";
  if (PRE_INSTALL_STAGES.includes(j.stage))
    return j.installDate && j.installDate <= addDaysISO(today, INSTALLING_DAYS) ? "installing" : "ready";
  if (INSTALLED_STAGES.includes(j.stage)) return nextAfterStep(j) ? "finishing" : "done";
  return null;
}

/** The quick filters within a stage, in order. */
export function filtersFor(phase: JobPhase): { id: string; label: string }[] {
  switch (phase) {
    case "selling":
      return OPEN_STAGES.map((s) => ({ id: s, label: STAGE_LABELS[s] }));
    case "ready":
      return [
        { id: "preapproval", label: "Pre-approval" },
        { id: "solarvic", label: "Solar Victoria" },
        { id: "book", label: "To book" },
        { id: "booked", label: "Booked" },
      ];
    case "installing":
      return [
        { id: "due", label: "Today or overdue" },
        { id: "week", label: "This week" },
      ];
    case "finishing":
      return (["invoice", "coes", "stcs", "grid"] as const).map((s) => ({ id: s, label: AFTER_STEP_WORDS[s].title }));
    case "done":
      return [];
  }
}

/** Which of its stage's filters a job sits under. */
export function filterOf(j: PhaseJob, phase: JobPhase, today: ISODate): string | null {
  switch (phase) {
    case "selling":
      return j.stage;
    case "ready":
      return gateOf(j) ?? "booked";
    case "installing":
      return j.installDate && j.installDate <= today ? "due" : "week";
    case "finishing":
      return nextAfterStep(j);
    case "done":
      return null;
  }
}

/** A job's next step, in words, and whether it waits on the business ("you") or is moving along ("ok"). */
export function nextStepOf(j: PhaseJob, phase: JobPhase, today: ISODate): { words: string; tone: "you" | "ok" } {
  switch (phase) {
    case "selling":
      return j.stage === "lead"
        ? { words: "Design the roof", tone: "you" }
        : j.stage === "designed"
          ? { words: "Send the proposal", tone: "you" }
          : { words: "Waiting on the customer", tone: "ok" };
    case "ready": {
      const gate = gateOf(j);
      if (gate === "preapproval") {
        const p = preApprovalOf(j);
        return p.tone === "waiting" ? { words: "Pre-approval submitted", tone: "ok" } : { words: "Submit the pre-approval", tone: "you" };
      }
      if (gate === "solarvic") {
        const s = solarVicOf(j);
        return s.tone === "waiting" ? { words: "Solar Victoria applied", tone: "ok" } : { words: "Check Solar Victoria", tone: "you" };
      }
      if (gate === "book") return { words: "Book the install", tone: "you" };
      return { words: j.stage === "won" ? "Booked · order the stock" : "Booked", tone: j.stage === "won" ? "you" : "ok" };
    }
    case "installing":
      return j.installDate && j.installDate < today
        ? { words: "Mark it installed", tone: "you" }
        : { words: j.installDate === today ? "Installing today" : "Booked", tone: "ok" };
    case "finishing": {
      const step = nextAfterStep(j);
      return step ? { words: AFTER_STEP_WORDS[step].doing, tone: "you" } : { words: "All done", tone: "ok" };
    }
    case "done":
      return { words: "All done", tone: "ok" };
  }
}

/** The jobs at a stage (and filter, when one is picked), in the order they're worth looking at. */
export function jobsAt<J extends PhaseJob & Pick<Job, "updatedAt" | "wonAt" | "installedAt" | "createdAt">>(
  jobs: readonly J[],
  phase: JobPhase,
  filter: string | null,
  today: ISODate,
): J[] {
  const at = jobs.filter((j) => phaseOf(j, today) === phase && (!filter || filterOf(j, phase, today) === filter));
  const key = (j: J): string =>
    phase === "selling"
      ? j.updatedAt
      : phase === "ready"
        ? (j.wonAt ?? j.createdAt)
        : phase === "installing"
          ? (j.installDate ?? "")
          : (j.installedAt ?? j.installDate ?? j.updatedAt);
  // Selling and Done show the newest first; the rest the longest waiting (or soonest) first.
  const newestFirst = phase === "selling" || phase === "done";
  return [...at].sort((a, b) => (newestFirst ? key(b).localeCompare(key(a)) : key(a).localeCompare(key(b))));
}

/** How many jobs sit at each stage. */
export function phaseCounts(jobs: readonly PhaseJob[], today: ISODate): Record<JobPhase, number> {
  const counts: Record<JobPhase, number> = { selling: 0, ready: 0, installing: 0, finishing: 0, done: 0 };
  for (const j of jobs) {
    const p = phaseOf(j, today);
    if (p) counts[p]++;
  }
  return counts;
}

/** The one figure each stage's tile carries: value in play, waiting on you, this week, steps to do, done this year. */
export function phaseNote(jobs: readonly (PhaseJob & Pick<Job, "value" | "installedAt">)[], phase: JobPhase, today: ISODate): string {
  const at = jobs.filter((j) => phaseOf(j, today) === phase);
  switch (phase) {
    case "selling": {
      const value = at.reduce((sum, j) => sum + (j.value ?? 0), 0);
      return value > 0 ? `$${Math.round(value / 1000).toLocaleString("en-AU")}k in play` : "Nothing in play";
    }
    case "ready":
    case "finishing": {
      const yours = at.filter((j) => nextStepOf(j, phase, today).tone === "you").length;
      return yours ? `${yours} waiting on you` : "Nothing waiting on you";
    }
    case "installing": {
      const due = at.filter((j) => j.installDate && j.installDate <= today).length;
      return due ? `${due} today or overdue` : "This week";
    }
    case "done": {
      const year = today.slice(0, 4);
      return `${at.filter((j) => (j.installedAt ?? "").startsWith(year)).length} this year`;
    }
  }
}

/** The job's stage in words for its row: "Proposal sent", "Installed 3 Nov". */
export const stageWords = (stage: JobStage) => STAGE_LABELS[stage];
