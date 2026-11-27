/**
 * A deal's grid connection after the install, worked through in RENUABL (27 Nov 2026, Martin: "Yes, build it", the
 * same card as the network pre-approval for the step after the install).
 *
 * Once a system is installed and inspected it still has to be connected: the completed installation goes to the
 * network (its portal, which only the business can sign in to) and the electrical works request to the customer's
 * electricity retailer, who arranges the meter; exports start only then. Those are the usual steps, each network's own
 * guide decides. Everything round them is here: who to raise it with, the deal's details to copy across (the as-built's
 * serials among them), what is still missing (filled in on the spot), and where it stands (raised with its reference,
 * connected), kept on the deal's own fields so Grid connections, After install and the deal follow. Nothing is sent to
 * the network or the retailer. Pure, tested.
 */
import type { AsBuilt } from "./as-built";
import type { JobStage } from "./crm";
import { GRID_STATE_WORDS, gridStateOf, inspectionDone, type GridState } from "./deal";
import { cleanNmi, NMI_WRONG, NOTHING_TO_SAVE, type PreApprovalView } from "./preapproval";
import type { PortalFact } from "./sol-portal";

/** The deal's own fields a person may fill in from the card. */
export const GRID_FIELDS = ["nmi", "meterNo", "retailer"] as const;
export type GridField = (typeof GRID_FIELDS)[number];
export const GRID_FIELD_WORDS: Record<GridField, { label: string; hint: string }> = {
  nmi: { label: "NMI", hint: "10 or 11 characters, on the customer's bill" },
  meterNo: { label: "Meter number", hint: "On the meter or the bill" },
  retailer: { label: "Electricity retailer", hint: "Who the customer's bill is from" },
};

/** Where the deal keeps the connection's reference (deal-sections.ts, the Network tab). */
export const GRID_REF_KEY = "gridConnectionRef";

/** How a state is kept on the deal (crm.ts `PROGRESS.gridConnection`). */
export const GRID_KEPT: Record<GridState, "pending" | "underway" | "completed"> = {
  "to-raise": "pending",
  raised: "underway",
  connected: "completed",
};

/** Everything the card shows for one deal. */
export interface GridConnectionView {
  jobId: string;
  customer: string;
  network: { name: string; guessed: boolean } | null;
  portal: { id: string; name: string; url: string; known: boolean } | null;
  /** The customer's electricity retailer, who arranges the meter; "" when the deal doesn't say. */
  retailer: string;
  facts: PortalFact[];
  missing: { fields: GridField[]; other: string[] };
  fields: Record<GridField, string>;
  /** The inspection is done (the certificate of electrical safety is in): the connection can be raised. */
  inspected: boolean;
  state: GridState;
  words: string;
  reference: string;
}

type Details = Record<string, string | null | undefined>;
const one = (v: unknown, max: number) =>
  typeof v === "string"
    ? v
        .replace(/[\u0000-\u001f\u007f]/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, max)
    : "";

/** The as-built's lines for the connection: when it went in and each serial the network asks for. */
export function asBuiltFacts(built: AsBuilt | null, installedOn: string | null): PortalFact[] {
  const out: PortalFact[] = [];
  const day = built?.installedOn || installedOn;
  if (day) out.push({ label: "Installed on", value: day.slice(0, 10) });
  (built?.inverters ?? []).forEach((inv, i, all) => {
    if (inv.serial.trim())
      out.push({
        label: all.length > 1 ? `Inverter ${i + 1} serial` : "Inverter serial",
        value: one(`${inv.serial}${inv.model ? ` (${inv.model})` : ""}`, 160),
      });
  });
  if (built?.battery?.serials.length) out.push({ label: "Battery serials", value: one(built.battery.serials.join(", "), 160) });
  return out;
}

/**
 * The view, from the deal's pre-approval view (its network, portal and the lines to copy), the deal as typed and the
 * as-built. The pre-approval's own outcome rides along as lines: its reference and any export limit.
 */
export function gridConnectionView(deal: {
  pre: PreApprovalView;
  typed: Details;
  stage: JobStage;
  installedOn: string | null;
  built: AsBuilt | null;
}): GridConnectionView {
  const { pre, typed } = deal;
  const details = Object.fromEntries(Object.entries(typed).filter((e): e is [string, string] => typeof e[1] === "string"));
  const has = (k: string) => Boolean(details[k]?.trim());
  const inspected = inspectionDone({ details, stage: deal.stage });
  const serials = (deal.built?.inverters ?? []).some((i) => i.serial.trim());
  const other: string[] = [];
  if (!inspected) other.push("The certificate of electrical safety (mark the CoES received on After install once it is in)");
  if (!serials) other.push("The inverter's serial number (record the as-built on the job card)");
  if (!pre.facts.some((f) => f.label === "Inverter")) other.push("The inverter's make and model");
  const extra: PortalFact[] = [
    ...(pre.reference ? [{ label: "Pre-approval reference", value: pre.reference }] : []),
    ...(pre.exportLimit ? [{ label: "Export limit", value: `${pre.exportLimit} kW` }] : []),
    ...asBuiltFacts(deal.built, deal.installedOn),
  ];
  const state = gridStateOf({ details });
  return {
    jobId: pre.jobId,
    customer: pre.customer,
    network: pre.network,
    portal: pre.portal,
    retailer: (details.retailer ?? "").trim(),
    facts: [...pre.facts, ...extra].slice(0, 24),
    missing: { fields: GRID_FIELDS.filter((k) => !has(k)), other },
    fields: Object.fromEntries(GRID_FIELDS.map((k) => [k, (details[k] ?? "").trim()])) as Record<GridField, string>,
    inspected,
    state,
    words: GRID_STATE_WORDS[state],
    reference: (details[GRID_REF_KEY] ?? "").trim(),
  };
}

/** A change from the card (or one Sol proposes): fields filled in, and where the connection stands. */
export interface GridChange {
  nmi?: string;
  meterNo?: string;
  retailer?: string;
  state?: GridState;
  reference?: string;
}

export const STATE_WRONG = "That isn't a grid connection state.";
const STATES = Object.keys(GRID_KEPT) as GridState[];

/** A change, checked. Only what was sent is kept. */
export function cleanGridChange(raw: unknown): { ok: true; change: GridChange } | { ok: false; message: string } {
  const r = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const change: GridChange = {};
  if (typeof r.nmi === "string" && r.nmi.trim()) {
    const nmi = cleanNmi(r.nmi);
    if (!nmi) return { ok: false, message: NMI_WRONG };
    change.nmi = nmi;
  }
  for (const k of ["meterNo", "retailer"] as const) {
    const v = one(r[k], 120);
    if (v) change[k] = v;
  }
  if (r.state !== undefined && r.state !== null && r.state !== "") {
    if (!STATES.includes(r.state as GridState)) return { ok: false, message: STATE_WRONG };
    change.state = r.state as GridState;
  }
  const reference = one(r.reference, 120);
  if (reference) change.reference = reference;
  return Object.keys(change).length ? { ok: true, change } : { ok: false, message: NOTHING_TO_SAVE };
}

/** The deal's details with a change put in. */
export function withGridChange(details: Record<string, string>, c: GridChange): Record<string, string> {
  const next: Record<string, string> = { ...details };
  for (const k of GRID_FIELDS) if (c[k]) next[k] = c[k]!;
  if (c.reference) next[GRID_REF_KEY] = c.reference;
  if (c.state) next.gridConnection = GRID_KEPT[c.state];
  return next;
}

/** The change as the deal's record says it. */
export function gridRecordLine(c: GridChange, who: { network: string | null; retailer: string }): string {
  const filled = GRID_FIELDS.filter((k) => c[k]).map((k) => `${GRID_FIELD_WORDS[k].label} ${c[k]}`);
  const withWhom = [who.network, c.retailer || who.retailer].filter(Boolean).join(" and ");
  const ref = c.reference ? ` · reference ${c.reference}` : "";
  const said =
    c.state === "raised"
      ? `Grid connection raised${withWhom ? ` with ${withWhom}` : ""}${ref}.`
      : c.state === "connected"
        ? `Grid connection completed${who.network ? ` (${who.network})` : ""}${ref}: the system is connected.`
        : c.state === "to-raise"
          ? "Grid connection put back to not raised."
          : c.reference
            ? `Grid connection${ref}.`
            : "";
  return [said, filled.length ? `Filled in for the grid connection: ${filled.join(", ")}.` : ""].filter(Boolean).join(" ");
}

/** What Sol may propose from the member's own words: what reads is kept, the rest dropped. Null when nothing does. */
export function cleanGridSuggestion(raw: unknown): GridChange | null {
  const r = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const got = cleanGridChange({
    ...r,
    nmi: cleanNmi(r.nmi) || undefined,
    state: STATES.includes(r.state as GridState) ? r.state : undefined,
  });
  return got.ok ? got.change : null;
}

/** What Sol is told once the grid connection card is up. */
export function gridNote(v: GridConnectionView, suggested: GridChange | null): string {
  const needs = [...v.missing.fields.map((k) => GRID_FIELD_WORDS[k].label), ...v.missing.other];
  return [
    `A card is now under your answer for ${v.customer}'s grid connection after the install: the deal's details to copy across (${v.facts.map((f) => f.label).join(", ")}), a button that opens ${v.network?.name ?? "the network"}'s ${v.portal?.known ? "portal" : "website"} in its own window beside RENUABL, and where it stands, kept on the deal.`,
    `It stands at: ${v.words}${v.reference ? ` (reference ${v.reference})` : ""}.`,
    v.network?.guessed ? "The network was read from the postcode, a guess near a boundary: say to check the NMI on the bill." : "",
    needs.length ? `Still needed: ${needs.join("; ")}.` : "",
    v.inspected
      ? ""
      : "The inspection isn't marked done on the deal yet (no certificate of electrical safety): say so, a connection is usually raised once it is in.",
    suggested ? "What they told you is filled in on the card, saved when they press Save: say so, and never say it is saved." : "",
    "The usual steps are the completed installation lodged with the network and the electrical works request sent to the customer's electricity retailer, who arranges the meter; say they are the usual ones and that the network's own guide decides. Say so in two or three short sentences, don't repeat the details, never say you can't open the portal, and never say when it will be connected.",
  ]
    .filter(Boolean)
    .join(" ");
}
