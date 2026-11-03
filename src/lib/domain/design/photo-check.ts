/**
 * Sol checks a job card's photos on install day (3 Nov 2026, Martin): when the installer posts photos, Sol looks at
 * them against the design and the as-built record and writes one note on the card: what is shown, what is still to
 * photograph or record, and anything to check. A helper for the office, never an inspection: he never says the work
 * complies, only what the photos show and what to check. Pure, tested in `photo-check.test.ts`.
 */

import { asBuiltFrom, asBuiltMissing, type AsBuiltInput, type Designed } from "./as-built";

/** The shots an install's job card should have, in the order they're taken (as the homeowner handover asks). */
export const EXPECTED_SHOTS = [
  "the roof before work",
  "each array of panels",
  "the inverter, and its serial label",
  "the battery and each module's serial label (when there is one)",
  "the switchboard",
  "the commissioning screen or app",
] as const;

/** The most photos one check looks at (the newest), so it stays quick and within the request's limits. */
export const PHOTO_CHECK_MAX = 8;
/** An automatic check runs at most this often a job, after the installer posts photos. */
export const AUTO_CHECK_MINUTES = 30;
/** Sol's name on the card's thread. */
export const PHOTO_CHECK_BY = "Sol";

export const PHOTO_CHECK_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["seen", "missing", "check"],
  properties: {
    seen: { type: "array", items: { type: "string" }, description: "What the photos clearly show, each in a few words." },
    missing: {
      type: "array",
      items: { type: "string" },
      description: "Expected shots not in the photos, or things to record, each in a few words.",
    },
    check: {
      type: "array",
      items: { type: "string" },
      description: "Things the photos suggest checking, each one sentence, phrased as something to check.",
    },
  },
} as const;

export interface PhotoFindings {
  seen: string[];
  missing: string[];
  check: string[];
}

/** What Sol is asked when he checks the photos. */
export function photoCheckPrompt(input: {
  details: readonly { label: string; value: string }[];
  designed: Designed | null;
  toRecord: readonly string[];
  photos: number;
}): string {
  const d = input.designed;
  const design = d
    ? [
        `${d.panels} × ${d.panelModel || "panels"}`,
        d.inverters.length ? `inverter: ${d.inverters.join(", ")}` : "",
        d.battery ? `battery: ${d.battery.model} (${d.battery.modules} modules)` : "no battery",
      ]
        .filter(Boolean)
        .join("; ")
    : "no design on file";
  return (
    `You help a solar business's office keep its install records whole. These are the ${input.photos} newest photos the installer posted on today's job card.\n` +
    `The system designed: ${design}.\n` +
    (input.details.length ? `The job: ${input.details.map((x) => `${x.label}: ${x.value}`).join("; ")}.\n` : "") +
    `Still to record on the as-built: ${input.toRecord.length ? input.toRecord.join(", ") : "nothing"}.\n` +
    `A job card should have photos of: ${EXPECTED_SHOTS.join("; ")}.\n\n` +
    `Say what the photos clearly show (seen), which expected shots or records are still missing (missing; count panels in an array only if you can clearly), ` +
    `and anything the photos suggest checking (check): a serial label not readable, a battery that looks close to a window, door or vent, labels or isolators not visible, a model that differs from the design, ` +
    `cables or mounting that look unfinished. Phrase each as something to check, never a verdict. Never say anything complies or is safe: the licensed electrician and the inspector decide that. ` +
    `Only what you can see: if unsure, leave it out. A few words each, at most six in each list.`
  );
}

const line = (v: unknown, max: number) =>
  typeof v === "string"
    ? v
        .replace(/[\u0000-\u001f\u007f]/g, " ")
        .replace(/\s{2,}/g, " ")
        .trim()
        .slice(0, max)
    : "";
const list = (v: unknown) =>
  (Array.isArray(v) ? v : [])
    .map((x) => line(x, 200))
    .filter(Boolean)
    .slice(0, 6);

export function cleanFindings(raw: unknown): PhotoFindings {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  return { seen: list(r.seen), missing: list(r.missing), check: list(r.check) };
}

/** What is still to record on the as-built: from the record when there is one, else from the design. */
export function stillToRecord(built: AsBuiltInput | null, designed: Designed | null): string[] {
  if (built) return asBuiltMissing(built);
  return designed ? asBuiltMissing(asBuiltFrom(designed)) : [];
}

/**
 * Sol's note on the card's thread, in plain lines. What the as-built still needs (`toRecord`, from the job's own
 * record) is always listed, whatever the photos showed.
 */
export function photoCheckNote(f: PhotoFindings, photos: number, toRecord: readonly string[] = []): string {
  const missing = [...f.missing.filter((m) => !toRecord.some((r) => r.toLowerCase() === m.toLowerCase())), ...toRecord];
  const parts = [`I looked at the ${photos} newest ${photos === 1 ? "photo" : "photos"}.`];
  if (f.seen.length) parts.push(`Shown: ${f.seen.join("; ")}.`);
  if (missing.length) parts.push(`Still to photograph or record: ${missing.join("; ")}.`);
  if (f.check.length) parts.push(`To check: ${f.check.join(" ")}`);
  if (!missing.length && !f.check.length) parts.push("Nothing missing that I can see.");
  parts.push("A helper from the photos, not an inspection.");
  return parts.join("\n").slice(0, 2000);
}

/**
 * Whether an automatic check runs after the installer posts photos: the job is installed today or yesterday (the
 * market's days), and Sol hasn't checked it in the last `AUTO_CHECK_MINUTES`.
 */
export function autoCheckDue(input: {
  installDate: string | null;
  today: string;
  yesterday: string;
  lastCheck: string | null;
  now: Date;
}): boolean {
  if (!input.installDate || (input.installDate !== input.today && input.installDate !== input.yesterday)) return false;
  if (!input.lastCheck) return true;
  return input.now.getTime() - Date.parse(input.lastCheck) >= AUTO_CHECK_MINUTES * 60_000;
}
