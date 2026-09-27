/** An existing inverter, read from the customer's photos. Pure and tested. */

export interface InverterReading {
  isInverter: boolean;
  brand: string | null;
  model: string | null;
  /** Rated AC output in kW. */
  ratedKw: number | null;
  phase: "single" | "three" | null;
  /** Hybrid inverters can run a battery directly. */
  hybrid: boolean | null;
}

export interface InverterSummary {
  brand: string | null;
  model: string | null;
  ratedKw: number | null;
  phase: "single" | "three" | null;
  hybrid: boolean | null;
  sample?: boolean;
}

export type InverterProblem = "not-an-inverter" | "unreadable";

export const INVERTER_PHOTOS = {
  max: 3,
  maxTotalBytes: 4 * 1024 * 1024,
} as const;

const text = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim().slice(0, 60) : null);

export function summariseInverter(raw: Partial<Record<keyof InverterReading, unknown>>): InverterSummary | InverterProblem {
  if (raw.isInverter === false) return "not-an-inverter";
  const brand = text(raw.brand);
  const model = text(raw.model);
  const kw = typeof raw.ratedKw === "number" && raw.ratedKw > 0.5 && raw.ratedKw < 100 ? Math.round(raw.ratedKw * 100) / 100 : null;
  if (!brand && !model && !kw) return "unreadable";
  const phase = raw.phase === "single" || raw.phase === "three" ? raw.phase : null;
  const hybrid = typeof raw.hybrid === "boolean" ? raw.hybrid : null;
  return { brand, model, ratedKw: kw, phase, hybrid };
}

export function isInverterSummary(v: InverterSummary | InverterProblem): v is InverterSummary {
  return typeof v === "object";
}

/** "Fronius Primo 5.0-1 · 5 kW · single phase" */
export function describeInverter(i: InverterSummary) {
  return [
    [i.brand, i.model].filter(Boolean).join(" ") || "Inverter",
    i.ratedKw ? `${i.ratedKw} kW` : null,
    i.phase ? `${i.phase} phase` : null,
    i.hybrid ? "hybrid" : null,
  ]
    .filter(Boolean)
    .join(" · ");
}

export const INVERTER_PROBLEM_MESSAGES: Record<InverterProblem, string> = {
  "not-an-inverter": "Those photos don't look like a solar inverter. No problem, we'll check it on your call.",
  unreadable: "We couldn't read the label clearly. Try a closer photo of the sticker, or we'll check it on your call.",
};
