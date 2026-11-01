/**
 * A business's own product datasheets (22 Oct 2026, Martin: as Primero's): a
 * panel's or inverter's datasheet is read by Claude, a person checks the
 * figures, and once saved they are what the string check, auto-stringing and
 * Design it for me use for that product code, ahead of RENUABL's own figures
 * (`electrical.ts`). Nothing is taken as final from the reading: a figure that
 * is missing or out of range stops the save. Pure, tested.
 */
import { INVERTER_ELECTRICAL, PANEL_ELECTRICAL, type InverterElectrical, type MpptInput, type PanelElectrical } from "./electrical";

export type SheetKind = "panel" | "inverter";

/** A business's checked figures, by product code. */
export interface Datasheets {
  panels: Record<string, PanelElectrical>;
  inverters: Record<string, InverterElectrical>;
}
export const NO_DATASHEETS: Datasheets = { panels: {}, inverters: {} };

/** One saved datasheet, as Settings lists it. */
export interface SavedSheet {
  kind: SheetKind;
  sku: string;
  model: string;
  fileName: string;
  checkedBy: string;
  checkedAt: string;
  figures: PanelElectrical | InverterElectrical;
  /** Whether the sheet itself is kept with the figures, to open again. */
  hasFile?: boolean;
}

/** A sheet is kept with its figures when it fits in one request to the host (under Vercel's 4.5 MB limit). */
export const KEEP_SHEET_BYTES = 4 * 1024 * 1024;

/** What Claude read from a datasheet: every figure null where it couldn't be read. Percentages as printed (-0.25). */
export interface SheetReading {
  isDatasheet: boolean;
  kind: SheetKind | null;
  model: string | null;
  panel: {
    voc: number | null;
    vmp: number | null;
    isc: number | null;
    imp: number | null;
    vocPercentPerC: number | null;
    iscPercentPerC: number | null;
    pmaxPercentPerC: number | null;
  } | null;
  inverter: {
    maxVoltage: number | null;
    mppMin: number | null;
    mppMax: number | null;
    startVoltage: number | null;
    mppts: { maxCurrent: number | null; maxShortCircuit: number | null; strings: number | null }[];
  } | null;
}

/** The figures as the check form holds them: numbers as typed, so a blank is plain. */
export interface PanelForm {
  voc: string;
  vmp: string;
  isc: string;
  imp: string;
  vocPercent: string;
  iscPercent: string;
  pmaxPercent: string;
}
export interface InverterForm {
  maxVoltage: string;
  mppMin: string;
  mppMax: string;
  startVoltage: string;
  mppts: { maxCurrent: string; maxShortCircuit: string; strings: string }[];
}

const s = (n: number | null | undefined) => (typeof n === "number" && Number.isFinite(n) ? String(n) : "");

/** A reading as the form to check, blanks where nothing could be read. */
export function formFromReading(r: SheetReading): { kind: SheetKind; model: string; panel: PanelForm; inverter: InverterForm } {
  const p = r.panel;
  const i = r.inverter;
  return {
    kind: r.kind ?? (i ? "inverter" : "panel"),
    model: r.model?.trim().slice(0, 120) ?? "",
    panel: {
      voc: s(p?.voc),
      vmp: s(p?.vmp),
      isc: s(p?.isc),
      imp: s(p?.imp),
      vocPercent: s(p?.vocPercentPerC),
      iscPercent: s(p?.iscPercentPerC),
      pmaxPercent: s(p?.pmaxPercentPerC),
    },
    inverter: {
      maxVoltage: s(i?.maxVoltage),
      mppMin: s(i?.mppMin),
      mppMax: s(i?.mppMax),
      startVoltage: s(i?.startVoltage),
      mppts: (i?.mppts?.length ? i.mppts : [{ maxCurrent: null, maxShortCircuit: null, strings: null }]).slice(0, 12).map((m) => ({
        maxCurrent: s(m.maxCurrent),
        maxShortCircuit: s(m.maxShortCircuit),
        strings: s(m.strings),
      })),
    },
  };
}

type Checked<T> = { ok: true; value: T } | { ok: false; message: string };
const num = (v: unknown) => (typeof v === "number" ? v : typeof v === "string" && v.trim() ? Number(v.trim()) : NaN);
const within = (v: number, lo: number, hi: number) => Number.isFinite(v) && v >= lo && v <= hi;

/** A panel's figures as kept: each one present and in a range a solar panel can have. */
export function checkPanel(raw: Partial<Record<keyof PanelForm, unknown>>, basis: string): Checked<PanelElectrical> {
  const voc = num(raw.voc);
  const vmp = num(raw.vmp);
  const isc = num(raw.isc);
  const imp = num(raw.imp);
  const vocPct = num(raw.vocPercent);
  const iscPct = num(raw.iscPercent);
  const pmaxPct = num(raw.pmaxPercent);
  if (!within(voc, 5, 120) || !within(vmp, 5, 120)) return { ok: false, message: "Check Voc and Vmp: each between 5 and 120 volts." };
  if (vmp >= voc) return { ok: false, message: "Vmp should be lower than Voc." };
  if (!within(isc, 1, 30) || !within(imp, 1, 30)) return { ok: false, message: "Check Isc and Imp: each between 1 and 30 amps." };
  if (imp > isc) return { ok: false, message: "Imp should be no higher than Isc." };
  if (!within(vocPct, -1, 0)) return { ok: false, message: "The Voc temperature coefficient is a small negative % a degree, like -0.25." };
  if (!within(iscPct, 0, 0.2)) return { ok: false, message: "The Isc temperature coefficient is a small positive % a degree, like 0.045." };
  if (!within(pmaxPct, -1, 0))
    return { ok: false, message: "The Pmax temperature coefficient is a small negative % a degree, like -0.29." };
  return {
    ok: true,
    value: { voc, vmp, isc, imp, vocPerC: vocPct / 100, iscPerC: iscPct / 100, pmaxPerC: pmaxPct / 100, basis },
  };
}

/** An inverter's PV input figures as kept: each present, in range, and in a sensible order. */
export function checkInverter(
  raw: { maxVoltage?: unknown; mppMin?: unknown; mppMax?: unknown; startVoltage?: unknown; mppts?: unknown },
  basis: string,
): Checked<InverterElectrical> {
  const maxVoltage = num(raw.maxVoltage);
  const mppMin = num(raw.mppMin);
  const mppMax = num(raw.mppMax);
  const startVoltage = num(raw.startVoltage);
  if (!within(maxVoltage, 100, 1500)) return { ok: false, message: "Check the maximum input voltage: between 100 and 1,500 volts." };
  if (!within(mppMin, 20, 1500) || !within(mppMax, 20, 1500) || mppMin >= mppMax)
    return { ok: false, message: "Check the MPPT range: a lower and a higher voltage." };
  if (mppMax > maxVoltage) return { ok: false, message: "The top of the MPPT range can't be above the maximum input voltage." };
  if (!within(startVoltage, 20, maxVoltage)) return { ok: false, message: "Check the start voltage." };
  const list = Array.isArray(raw.mppts) ? raw.mppts.slice(0, 12) : [];
  if (!list.length) return { ok: false, message: "Add each MPPT input." };
  const mppts: MpptInput[] = [];
  for (const [n, m] of list.entries()) {
    const r = (m && typeof m === "object" ? m : {}) as Record<string, unknown>;
    const maxCurrent = num(r.maxCurrent);
    const maxShortCircuit = num(r.maxShortCircuit);
    const strings = num(r.strings);
    if (!within(maxCurrent, 1, 100) || !within(maxShortCircuit, 1, 120) || maxShortCircuit < maxCurrent)
      return { ok: false, message: `Check MPPT ${n + 1}'s currents: the short-circuit limit is at least the working current.` };
    if (!Number.isInteger(strings) || !within(strings, 1, 6))
      return { ok: false, message: `Check how many strings MPPT ${n + 1} takes (1 to 6).` };
    mppts.push({ maxCurrent, maxShortCircuit, strings });
  }
  return { ok: true, value: { maxVoltage, mppMin, mppMax, startVoltage, mppts, basis } };
}

/** Where the figures came from, as the string check names it. */
export const sheetBasis = (model: string, fileName: string, checkedBy: string, on: string) =>
  `${model || "Datasheet"} (${fileName || "uploaded datasheet"}), read and checked by ${checkedBy.split("@")[0]} on ${on}`;

/** A product code as kept: the supplier's code, as it is on the price list. */
export const cleanSku = (v: unknown) => (typeof v === "string" ? v.trim().replace(/\s+/g, " ").slice(0, 80) : "");

/** The designer's products with the business's checked figures put in, ahead of RENUABL's own. */
export function withDatasheets<T extends { sku: string; electrical?: unknown }>(
  products: readonly T[],
  sheets: Record<string, T["electrical"]> | undefined,
): T[] {
  if (!sheets) return [...products];
  // Matched by `codeKey`, so a code written another way on the price list still finds its datasheet (as Primero's).
  const byKey = new Map(Object.entries(sheets).map(([k, v]) => [codeKey(k), v]));
  return products.map((p) => {
    const sheet = sheets[p.sku] ?? byKey.get(codeKey(p.sku));
    return sheet ? { ...p, electrical: sheet } : p;
  });
}

/**
 * A product code as it is compared: case, spaces, dashes and underscores ignored, and ".0" before a letter dropped, so
 * a price list's "SGWSH10RT" and the "SGWSH10.0RT" on a datasheet are the same inverter.
 */
export function codeKey(sku: string): string {
  return sku
    .toUpperCase()
    .replace(/\.0(?=[A-Z])/g, "")
    .replace(/[\s_-]+/g, "");
}

/** A panel's or inverter's figures in one line, as Sol is given them. */
export function figuresLine(kind: SheetKind, f: PanelElectrical | InverterElectrical): string {
  const pct = (v: number) => `${(v * 100).toFixed(2)}%/°C`;
  if (kind === "panel") {
    const p = f as PanelElectrical;
    return `Voc ${p.voc} V, Vmp ${p.vmp} V, Isc ${p.isc} A, Imp ${p.imp} A, Voc ${pct(p.vocPerC)}, Isc ${pct(p.iscPerC)}, Pmax ${pct(p.pmaxPerC)}`;
  }
  const i = f as InverterElectrical;
  const mppts = i.mppts.map(
    (m, n) => `MPPT ${n + 1}: ${m.maxCurrent} A, short-circuit ${m.maxShortCircuit} A, ${m.strings} string${m.strings === 1 ? "" : "s"}`,
  );
  return `max input ${i.maxVoltage} V, MPPT range ${i.mppMin}–${i.mppMax} V, start ${i.startVoltage} V; ${mppts.join("; ")}`;
}

/**
 * The figures Sol answers with for a product code or model words: the business's checked sheets first, then RENUABL's
 * own (each said where it came from), at most ten.
 */
export function datasheetFigures(
  sheets: readonly Pick<SavedSheet, "kind" | "sku" | "model" | "figures" | "checkedBy" | "checkedAt">[],
  query: string,
  ours: { panels: Record<string, PanelElectrical>; inverters: Record<string, InverterElectrical> } = {
    panels: PANEL_ELECTRICAL,
    inverters: INVERTER_ELECTRICAL,
  },
): string {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return "Say which product to look up.";
  const hit = (text: string) => words.every((w) => text.toLowerCase().includes(w));
  const own = sheets
    .filter((s) => hit(`${s.sku} ${s.model}`))
    .map(
      (s) =>
        `${s.sku}${s.model ? ` (${s.model})` : ""} · ${s.kind}: ${figuresLine(s.kind, s.figures)} · from the business's datasheet, checked by ${s.checkedBy.split("@")[0]} ${s.checkedAt.slice(0, 10)}`,
    );
  const have = new Set(sheets.map((s) => `${s.kind}:${s.sku}`));
  const renuabl = [
    ...Object.entries(ours.panels).map(([sku, f]) => ({ kind: "panel" as const, sku, f })),
    ...Object.entries(ours.inverters).map(([sku, f]) => ({ kind: "inverter" as const, sku, f })),
  ]
    .filter((p) => !have.has(`${p.kind}:${p.sku}`) && hit(`${p.sku} ${p.f.basis}`))
    .map((p) => `${p.sku} · ${p.kind}: ${figuresLine(p.kind, p.f)} · RENUABL's figures (${p.f.basis}; check against the datasheet)`);
  const all = [...own, ...renuabl];
  if (!all.length) return "No datasheet figures match that. They can be added under Settings, Product datasheets.";
  return all.slice(0, 10).join("\n");
}
