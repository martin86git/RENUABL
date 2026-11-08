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
  /** Where RENUABL found the sheet online, when it found it by itself. */
  foundUrl?: string | null;
  /** Found online and not yet checked by a person. */
  unchecked?: boolean;
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

// ---------------------------------------------------------------------------
// Found online by themselves (3 Nov 2026, Martin: "an auto function that does this each time a product is added")
// ---------------------------------------------------------------------------

/** The most products whose datasheets are looked for at one go (a price list upload): each is a few searches. */
export const FIND_AT_ONCE = 8;

/** The panels and inverters on a price list with no figures anywhere: not the business's, not RENUABL's own. */
export function missingSheets(
  list: { panels: readonly { sku: string; name: string }[]; inverters: readonly { sku: string; name: string }[] },
  sheets: Datasheets,
): { kind: SheetKind; sku: string; name: string }[] {
  const known = (kind: SheetKind) =>
    new Set(
      Object.keys(kind === "panel" ? { ...PANEL_ELECTRICAL, ...sheets.panels } : { ...INVERTER_ELECTRICAL, ...sheets.inverters }).map(
        codeKey,
      ),
    );
  const out: { kind: SheetKind; sku: string; name: string }[] = [];
  for (const kind of ["panel", "inverter"] as const) {
    const have = known(kind);
    const seen = new Set<string>();
    for (const p of kind === "panel" ? list.panels : list.inverters) {
      const key = codeKey(p.sku);
      if (!key || have.has(key) || seen.has(key)) continue;
      seen.add(key);
      out.push({ kind, sku: p.sku, name: p.name });
    }
  }
  return out;
}

/** Where figures found online came from, as the string check names it. */
export const foundBasis = (model: string, url: string, on: string) => {
  let host = "the web";
  try {
    host = new URL(url).hostname.replace(/^www\./, "");
  } catch {
    // Not an address: said plainly.
  }
  return `${model || "Datasheet"}, found online at ${host} on ${on} and read by itself: not yet checked`;
};

/**
 * A datasheet found online, read and checked the way a person's save is checked (every figure present and in range),
 * for the kind of product it was looked for. Not a reading of that kind, or a figure missing, is no figures at all.
 */
export function foundFigures(
  reading: SheetReading,
  kind: SheetKind,
  url: string,
  on: string,
): Checked<PanelElectrical | InverterElectrical> {
  if (!reading.isDatasheet) return { ok: false, message: "That isn't a datasheet for this product." };
  const form = formFromReading(reading);
  if (form.kind !== kind) return { ok: false, message: `That datasheet is for ${form.kind === "panel" ? "a panel" : "an inverter"}.` };
  const basis = foundBasis(form.model, url, on);
  return kind === "panel" ? checkPanel(form.panel, basis) : checkInverter(form.inverter, basis);
}

/**
 * The links to try for a product's datasheet, best first, at most `MAX_SHEET_TRIES`: only links the search really
 * showed or opened (Claude can write a plausible address that doesn't exist), PDFs first, those naming more of the
 * product code first, the one Claude chose ahead of its equals; Claude's own answer last when it never appeared.
 */
export const MAX_SHEET_TRIES = 5;
/**
 * Australia's version of a sheet first (8 Nov 2026, Martin: the sheet found for a Jinko panel was the EU one): a link on
 * an Australian site or marked AU/Australia scores up, one marked for Europe, the US or another market down. Only a
 * leaning between links the search showed: the reader still checks the model is the one asked for.
 */
export function sheetRegionScore(url: string): number {
  let host = "";
  let path = "";
  try {
    const u = new URL(url);
    host = u.hostname.toLowerCase();
    path = u.pathname.toLowerCase();
  } catch {
    return 0;
  }
  const marked = (words: string) => new RegExp(`(^|[^a-z])(${words})([^a-z]|$)`).test(path);
  if (host.endsWith(".au") || marked("au|aus|australia")) return 20;
  if (/\.(eu|de|uk|us|cn|in)$/.test(host) || marked("eu|europe|us|usa|uk|de|latam|mea|india|cn")) return -20;
  return 0;
}

/** Whether the sheet's link says it is Australia's version. */
export const isAustralianSheet = (url: string) => sheetRegionScore(url) > 0;

export function sheetCandidates(answer: string | null, seen: readonly string[], sku: string): string[] {
  const parts = sku
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((p) => p.length >= 2);
  const unique = [...new Set(seen.filter((u) => /^https:\/\//i.test(u)))];
  const isPdf = (u: string) => /\.pdf($|[?#])/i.test(u);
  const score = (u: string) => {
    const l = u.toLowerCase();
    return (isPdf(u) ? 100 : 0) + parts.filter((p) => l.includes(p)).length * 10 + (u === answer ? 5 : 0) + sheetRegionScore(u);
  };
  const ranked = unique.filter((u) => isPdf(u) || u === answer).sort((a, b) => score(b) - score(a));
  if (answer && /^https:\/\//i.test(answer) && !ranked.includes(answer)) ranked.push(answer);
  return ranked.slice(0, MAX_SHEET_TRIES);
}

/** What the datasheet reader answers: every figure a number, 0 where it couldn't be read (see `readingFrom`). */
export interface RawReading {
  isDatasheet: boolean;
  kind: "panel" | "inverter" | "unknown";
  model: string;
  panel: Record<"voc" | "vmp" | "isc" | "imp" | "vocPercentPerC" | "iscPercentPerC" | "pmaxPercentPerC", number>;
  inverter: {
    maxVoltage: number;
    mppMin: number;
    mppMax: number;
    startVoltage: number;
    mppts: { maxCurrent: number; maxShortCircuit: number; strings: number }[];
  };
}

/**
 * The reader's answer as a reading: a 0 (no real figure is 0) is a figure that couldn't be read, so null; the other
 * kind's figures are null as a whole.
 */
export function readingFrom(raw: RawReading): SheetReading {
  const n = (v: unknown) => (typeof v === "number" && Number.isFinite(v) && v !== 0 ? v : null);
  const kind = raw.kind === "panel" || raw.kind === "inverter" ? raw.kind : null;
  const p = raw.panel;
  const i = raw.inverter;
  return {
    isDatasheet: Boolean(raw.isDatasheet),
    kind,
    model: raw.model?.trim() || null,
    panel:
      kind === "inverter" || !p
        ? null
        : {
            voc: n(p.voc),
            vmp: n(p.vmp),
            isc: n(p.isc),
            imp: n(p.imp),
            vocPercentPerC: n(p.vocPercentPerC),
            iscPercentPerC: n(p.iscPercentPerC),
            pmaxPercentPerC: n(p.pmaxPercentPerC),
          },
    inverter:
      kind === "panel" || !i
        ? null
        : {
            maxVoltage: n(i.maxVoltage),
            mppMin: n(i.mppMin),
            mppMax: n(i.mppMax),
            startVoltage: n(i.startVoltage),
            mppts: (i.mppts ?? []).map((m) => ({
              maxCurrent: n(m.maxCurrent),
              maxShortCircuit: n(m.maxShortCircuit),
              strings: n(m.strings),
            })),
          },
  };
}
