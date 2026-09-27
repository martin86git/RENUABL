import type { FieldStatus, JobStage, StatusEvent } from "./types";

export const FIELD_STATUS_FLOW: { id: FieldStatus; label: string; action: string; notifiesCustomer: boolean }[] = [
  { id: "en-route", label: "En route", action: "Start driving", notifiesCustomer: true },
  { id: "on-site", label: "On site", action: "Arrived on site", notifiesCustomer: true },
  { id: "installing", label: "Installation in progress", action: "Start installation", notifiesCustomer: false },
  { id: "final-checks", label: "Final checks", action: "Begin final checks", notifiesCustomer: false },
  { id: "complete", label: "Complete", action: "Mark complete", notifiesCustomer: true },
];

export function currentFieldStatus(history: StatusEvent[]): FieldStatus | null {
  return history.length ? history[history.length - 1].status : null;
}

/** Next status in the strictly sequential field flow, or null when complete. */
export function nextFieldStatus(current: FieldStatus | null) {
  if (current === null) return FIELD_STATUS_FLOW[0];
  const idx = FIELD_STATUS_FLOW.findIndex((s) => s.id === current);
  return idx >= 0 && idx < FIELD_STATUS_FLOW.length - 1 ? FIELD_STATUS_FLOW[idx + 1] : null;
}

export function advanceStatus(history: StatusEvent[], at: Date = new Date()): StatusEvent[] {
  const next = nextFieldStatus(currentFieldStatus(history));
  if (!next) return history;
  return [...history, { status: next.id, at: at.toISOString() }];
}

export function stageForFieldStatus(status: FieldStatus | null, fallback: JobStage): JobStage {
  if (status === null) return fallback;
  return status === "complete" ? "completed" : "in-progress";
}

export const JOB_STAGES: { id: JobStage; label: string }[] = [
  { id: "new", label: "New" },
  { id: "accepted", label: "Accepted" },
  { id: "scheduled", label: "Scheduled" },
  { id: "in-progress", label: "In progress" },
  { id: "completed", label: "Completed" },
];

export function stageLabel(stage: JobStage) {
  return JOB_STAGES.find((s) => s.id === stage)?.label ?? stage;
}

/** The single most useful next action for a job in the list view. */
export function primaryJobAction(stage: JobStage): string {
  switch (stage) {
    case "new":
      return "Review & accept";
    case "accepted":
      return "Confirm schedule";
    case "scheduled":
      return "Open site pack";
    case "in-progress":
      return "Update status";
    case "completed":
      return "View handover";
  }
}
