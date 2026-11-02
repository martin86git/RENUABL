/**
 * The installer nominates the electrical inspector (1 Nov 2026, Martin: step 4 of the network; the installer
 * nominates, never the retailer, and the inspector then sees the installation photos). On a job it has accepted, an
 * installer picks an inspector it is connected with. The inspector sees the job in Inspections and opens it read only:
 * the day, the address, the customer's name and phone (never their email), the system, the drawings and every note
 * and photo on the job card. The inspector records where it stands (booked for a day, passed, or defects found) with
 * notes and the certificate, which the installer and the retailer both see. One live inspection a job; the installer
 * can take the nomination back, the inspector can decline, and disconnecting closes it. Pure, tested.
 */

export const INSPECTION_STATES = ["nominated", "booked", "passed", "defects", "declined", "withdrawn"] as const;
export type InspectionState = (typeof INSPECTION_STATES)[number];

/** States the inspector records. */
export const OUTCOMES = ["booked", "passed", "defects"] as const;
export type Outcome = (typeof OUTCOMES)[number];

export const OUTCOME_WORDS: Record<Outcome, string> = { booked: "Booked", passed: "Passed", defects: "Defects found" };

/** Whether an inspection still gives the inspector the job. */
export const inspectionLive = (s: InspectionState) => s !== "declined" && s !== "withdrawn";

export const NOTES_MAX = 2000;
/** A certificate: a PDF or a photo, kept under the request limit a host allows. */
export const CERT_MAX_BYTES = 4 * 1024 * 1024;
const CERT_TYPES = ["application/pdf", "image/jpeg", "image/png", "image/webp"];

export interface InspectionView {
  id: string;
  inspector: string;
  installer: string;
  state: InspectionState;
  /** The day it is booked for, or null. */
  on: string | null;
  notes: string;
  certificate: { name: string } | null;
  updatedAt: string;
}

/** What the inspector sees in the list before opening: where, when, what, and who nominated them. */
export interface InspectionLine {
  id: string;
  from: string;
  suburb: string;
  installDate: string | null;
  system: string;
  state: InspectionState;
  on: string | null;
}

/** Why an installer can't nominate that inspector for this job, or null. */
export function nominateRefusal(input: { accepted: boolean; connected: boolean; kind: string; live: boolean }): string | null {
  if (!input.accepted) return "Accept the job first.";
  if (!input.connected) return "You can only nominate inspectors you're connected with.";
  if (input.kind !== "inspector") return "Choose an electrical inspector.";
  if (input.live) return "An inspector is already nominated for this job. Take it back first.";
  return null;
}

const date = (v: unknown) => (typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null);

/** An outcome as sent: a state the inspector records, the day it is booked for (needed to book), and notes. */
export function cleanOutcome(
  raw: unknown,
): { ok: true; state: Outcome; on: string | null; notes: string } | { ok: false; message: string } {
  const r = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const state = (OUTCOMES as readonly string[]).includes(String(r.state)) ? (r.state as Outcome) : null;
  if (!state) return { ok: false, message: "Choose booked, passed or defects found." };
  const on = date(r.on);
  if (state === "booked" && !on) return { ok: false, message: "Give the day the inspection is booked for." };
  const notes =
    typeof r.notes === "string"
      ? r.notes
          .replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, "")
          .trim()
          .slice(0, NOTES_MAX)
      : "";
  if (state === "defects" && !notes) return { ok: false, message: "Say what the defects are, so the installer can put them right." };
  return { ok: true, state, on, notes };
}

/** Why a certificate can't be kept, or null. */
export function certificateProblem(file: { type: string; size: number }): string | null {
  if (!CERT_TYPES.includes(file.type.toLowerCase())) return "The certificate needs to be a PDF or a photo.";
  if (file.size > CERT_MAX_BYTES) return "The certificate is over 4 MB. A smaller scan or photo will do.";
  return null;
}

/** Whether a file's own bytes are what it says (a PDF or a picture), not just its name. */
export function looksLike(type: string, bytes: Uint8Array): boolean {
  const head = (n: number) => [...bytes.slice(0, n)];
  if (type === "application/pdf") return String.fromCharCode(...head(5)) === "%PDF-";
  if (type === "image/jpeg") return bytes[0] === 0xff && bytes[1] === 0xd8;
  if (type === "image/png") return head(4).join(",") === "137,80,78,71";
  if (type === "image/webp") return String.fromCharCode(...head(4)) === "RIFF" && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP";
  return false;
}

const dayWords = (iso: string) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-AU", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });

/** "Nominated: Gamma Inspections, waiting", "Booked for Thu 20 Nov", "Passed", "Defects found", … */
export function inspectionWords(i: Pick<InspectionView, "inspector" | "state" | "on">): string {
  if (i.state === "nominated") return `${i.inspector} nominated, waiting to book`;
  if (i.state === "booked") return `Booked with ${i.inspector}${i.on ? ` for ${dayWords(i.on)}` : ""}`;
  if (i.state === "passed") return `Passed: ${i.inspector}`;
  if (i.state === "defects") return `Defects found: ${i.inspector}`;
  if (i.state === "declined") return `${i.inspector} declined`;
  return `Nomination taken back from ${i.inspector}`;
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** To the inspector's owner, from RENUABL: who nominated them, where and when, and the way in. */
export function nominatedEmail(input: { installer: string; suburb: string; day: string | null; link: string }) {
  const when = input.day ? `, installed ${input.day}` : "";
  return {
    subject: `${input.installer} nominated you to inspect a job in ${input.suburb}`,
    text: `${input.installer} nominated you on RENUABL to inspect an installation in ${input.suburb}${when}. The design and their photos are on the job.\n\nOpen it: ${input.link}`,
    html: `<p>${esc(input.installer)} nominated you on RENUABL to inspect an installation in ${esc(input.suburb)}${esc(when)}. The design and their photos are on the job.</p><p><a href="${esc(input.link)}">Open it</a></p>`,
  };
}

/** To the installer and the retailer, from RENUABL: where the inspection stands. Nothing of the customer. */
export function outcomeEmail(input: { inspector: string; outcome: Outcome; suburb: string; on: string | null; link: string }) {
  const what =
    input.outcome === "booked"
      ? `booked the inspection${input.on ? ` for ${dayWords(input.on)}` : ""}`
      : input.outcome === "passed"
        ? "passed the installation"
        : "found defects to put right";
  return {
    subject: `Inspection in ${input.suburb}: ${OUTCOME_WORDS[input.outcome]}`,
    text: `${input.inspector} ${what} in ${input.suburb}.\n\nThe job: ${input.link}`,
    html: `<p>${esc(input.inspector)} ${esc(what)} in ${esc(input.suburb)}.</p><p><a href="${esc(input.link)}">The job</a></p>`,
  };
}
