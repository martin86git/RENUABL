/**
 * After the install: the paperwork that gets a Victorian home exporting and
 * its rebates paid. Who does each step depends on the partner: an installer
 * (installation only) signs off the electrical work and lodges the meter
 * request, while RENUABL, as the seller, handles pre-approval and rebates; a
 * retailer does all of it. Pure and tested.
 */
import type { PartnerType } from "./partner";
import type { ISODate } from "./types";

export type ConnectionStepId = "pre-approval" | "ces" | "ewr" | "meter" | "stc-claim" | "stc-paid" | "solar-vic";

export type StepOwner = "partner" | "renuabl";

export interface ConnectionStep {
  id: ConnectionStepId;
  label: string;
  detail: string;
  /** Who's responsible, for each kind of partner. For installers, RENUABL handles pre-approval, STCs and Solar Victoria (confirmed). */
  owner: Record<PartnerType, StepOwner>;
  /** Shown to the customer on their installation record, in plain words. */
  customerLabel: string;
  /** Only for homes claiming the Solar Victoria rebate. */
  solarVicOnly?: boolean;
}

export const CONNECTION_STEPS: ConnectionStep[] = [
  {
    id: "pre-approval",
    label: "Distributor pre-approval",
    detail: "Approval from the local distributor to connect the system (before install).",
    owner: { installer: "renuabl", retailer: "partner" },
    customerLabel: "Approval to connect",
  },
  {
    id: "ces",
    label: "Certificate of Electrical Safety",
    detail: "Lodged with Energy Safe Victoria and a copy given to the customer.",
    owner: { installer: "partner", retailer: "partner" },
    customerLabel: "Electrical safety certificate",
  },
  {
    id: "ewr",
    label: "Electrical Works Request",
    detail: "Sent to the customer's energy retailer so the meter can be set up for solar.",
    owner: { installer: "partner", retailer: "partner" },
    customerLabel: "Meter request sent",
  },
  {
    id: "meter",
    label: "Meter reconfigured",
    detail: "The distributor has set up the meter; the system can export.",
    owner: { installer: "partner", retailer: "partner" },
    customerLabel: "Meter set up for solar",
  },
  {
    id: "stc-claim",
    label: "STCs claimed",
    detail: "Small-scale technology certificates created with the Clean Energy Regulator.",
    owner: { installer: "renuabl", retailer: "partner" },
    customerLabel: "Federal rebate claimed",
  },
  {
    id: "stc-paid",
    label: "STCs approved",
    detail: "The certificates are registered and the rebate is settled.",
    owner: { installer: "renuabl", retailer: "partner" },
    customerLabel: "Federal rebate approved",
  },
  {
    id: "solar-vic",
    label: "Solar Victoria claim",
    detail: "The rebate (and loan, if taken) claimed in the Solar Victoria portal.",
    owner: { installer: "renuabl", retailer: "partner" },
    customerLabel: "Solar Victoria rebate claimed",
    solarVicOnly: true,
  },
];

export interface ConnectionProgress {
  done: ISODate;
  /** Reference number, e.g. the CES or pre-approval number. */
  reference?: string;
}

export type ConnectionRecord = Partial<Record<ConnectionStepId, ConnectionProgress>>;

/** The steps that apply to a job. */
export function connectionSteps(opts: { solarVictoria: boolean }): ConnectionStep[] {
  return CONNECTION_STEPS.filter((s) => !s.solarVicOnly || opts.solarVictoria);
}

/** The step to do next, and who owns it; null when everything's done. */
export function nextConnectionStep(record: ConnectionRecord, steps: ConnectionStep[], type: PartnerType) {
  const next = steps.find((s) => !record[s.id]);
  return next ? { step: next, owner: next.owner[type] } : null;
}

export function connectionComplete(record: ConnectionRecord, steps: ConnectionStep[]) {
  return steps.every((s) => record[s.id]);
}

/** Keeps only known steps with a real date and a short reference; from untrusted input. */
export function cleanConnection(raw: unknown): ConnectionRecord {
  if (!raw || typeof raw !== "object") return {};
  const out: ConnectionRecord = {};
  for (const step of CONNECTION_STEPS) {
    const v = (raw as Record<string, unknown>)[step.id];
    if (!v || typeof v !== "object") continue;
    const { done, reference } = v as { done?: unknown; reference?: unknown };
    if (typeof done !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(done) || Number.isNaN(Date.parse(done))) continue;
    const ref =
      typeof reference === "string"
        ? reference
            .replace(/[^\w\- /]/g, "")
            .trim()
            .slice(0, 40)
        : "";
    out[step.id] = ref ? { done, reference: ref } : { done };
  }
  return out;
}

/** A partner may update only the steps they own. */
export function partnerMayUpdate(step: ConnectionStepId, type: PartnerType) {
  return CONNECTION_STEPS.find((s) => s.id === step)?.owner[type] === "partner";
}

/** Marks a step done (with an optional reference) or not done. */
export function updateConnection(
  record: ConnectionRecord = {},
  step: ConnectionStepId,
  value: ConnectionProgress | null,
): ConnectionRecord {
  const next = { ...record };
  if (value) next[step] = value;
  else delete next[step];
  return cleanConnection(next);
}

export function isConnectionStep(v: unknown): v is ConnectionStepId {
  return CONNECTION_STEPS.some((s) => s.id === v);
}
