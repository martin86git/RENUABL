/**
 * Design through to as-built (2 Nov 2026, Martin): what was really installed, kept against the job by the installer
 * on their job card (or the business on the deal), with every serial number, and how it differs from the design.
 * The record becomes the job's warranty and service file. Pure, tested in `as-built.test.ts`.
 */

export interface AsBuilt {
  installedOn: string | null;
  panels: { model: string; count: number };
  panelSerials: string[];
  inverters: { model: string; serial: string }[];
  battery: { model: string; modules: number; serials: string[] } | null;
  notes: string;
  /** Who recorded it, and when (the server's time). */
  by: string;
  at: string;
}

export type AsBuiltInput = Omit<AsBuilt, "by" | "at">;

/** What the design says was to be installed: the starting point for the as-built, and what it is held against. */
export interface Designed {
  panels: number;
  panelModel: string;
  inverters: string[];
  battery: { model: string; modules: number } | null;
}

export const MAX_SERIALS = 200;

const text = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max) : "");
/** Serial numbers typed or pasted one a line (or with commas), each cleaned, no repeats. */
export function serialsOf(v: unknown): string[] {
  const list = Array.isArray(v) ? v : typeof v === "string" ? v.split(/[\n,;]+/) : [];
  const out: string[] = [];
  for (const s of list) {
    const clean = text(s, 60).toUpperCase();
    if (clean && /^[A-Z0-9][A-Z0-9 ./_-]*$/.test(clean) && !out.includes(clean)) out.push(clean);
    if (out.length >= MAX_SERIALS) break;
  }
  return out;
}

/** An as-built from a browser, checked and trimmed: anything not as expected is left out. */
export function cleanAsBuilt(raw: unknown): AsBuiltInput {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const count = (v: unknown, max: number) => (typeof v === "number" && Number.isInteger(v) && v >= 0 && v <= max ? v : 0);
  const p = (r.panels && typeof r.panels === "object" ? r.panels : {}) as Record<string, unknown>;
  const b = r.battery && typeof r.battery === "object" ? (r.battery as Record<string, unknown>) : null;
  return {
    installedOn: typeof r.installedOn === "string" && /^\d{4}-\d{2}-\d{2}$/.test(r.installedOn) ? r.installedOn : null,
    panels: { model: text(p.model, 120), count: count(p.count, 400) },
    panelSerials: serialsOf(r.panelSerials),
    inverters: (Array.isArray(r.inverters) ? r.inverters : [])
      .slice(0, 6)
      .map((i) => (i && typeof i === "object" ? (i as Record<string, unknown>) : {}))
      .map((i) => ({ model: text(i.model, 120), serial: serialsOf(i.serial)[0] ?? "" }))
      .filter((i) => i.model || i.serial),
    battery:
      b && (text(b.model, 120) || serialsOf(b.serials).length)
        ? { model: text(b.model, 120), modules: count(b.modules, 40), serials: serialsOf(b.serials) }
        : null,
    notes: typeof r.notes === "string" ? r.notes.trim().slice(0, 2000) : "",
  };
}

/** An as-built to start from: the design's own system, no serials yet. */
export function asBuiltFrom(designed: Designed): AsBuiltInput {
  return {
    installedOn: null,
    panels: { model: designed.panelModel, count: designed.panels },
    panelSerials: [],
    inverters: designed.inverters.map((model) => ({ model, serial: "" })),
    battery: designed.battery ? { model: designed.battery.model, modules: designed.battery.modules, serials: [] } : null,
    notes: "",
  };
}

const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

/** How what was installed differs from the design, in words; empty when it was built as designed. */
export function asBuiltDifferences(built: AsBuiltInput, designed: Designed): string[] {
  const out: string[] = [];
  if (built.panels.count !== designed.panels) out.push(`Panels: ${designed.panels} designed, ${built.panels.count} installed.`);
  if (built.panels.model && designed.panelModel && !same(built.panels.model, designed.panelModel))
    out.push(`Panel: designed ${designed.panelModel}, installed ${built.panels.model}.`);
  const builtInv = built.inverters.map((i) => i.model).filter(Boolean);
  if (builtInv.length !== designed.inverters.length || builtInv.some((m, i) => !same(m, designed.inverters[i] ?? "")))
    out.push(`Inverter: designed ${designed.inverters.join(", ") || "none"}, installed ${builtInv.join(", ") || "none"}.`);
  const bd = designed.battery;
  const bb = built.battery;
  if (!bd && bb) out.push(`Battery: none designed, ${bb.modules} × ${bb.model} installed.`);
  else if (bd && !bb) out.push(`Battery: ${bd.modules} × ${bd.model} designed, none installed.`);
  else if (bd && bb && (bd.modules !== bb.modules || !same(bd.model, bb.model)))
    out.push(`Battery: designed ${bd.modules} × ${bd.model}, installed ${bb.modules} × ${bb.model}.`);
  return out;
}

/** What is still to record for the as-built to be whole: a serial for every panel, inverter and battery module. */
export function asBuiltMissing(built: AsBuiltInput): string[] {
  const out: string[] = [];
  if (built.panelSerials.length < built.panels.count)
    out.push(
      `${built.panels.count - built.panelSerials.length} panel serial${built.panels.count - built.panelSerials.length === 1 ? "" : "s"}`,
    );
  const noSerial = built.inverters.filter((i) => !i.serial).length;
  if (noSerial) out.push(`${noSerial} inverter serial${noSerial === 1 ? "" : "s"}`);
  if (built.battery && built.battery.serials.length < built.battery.modules)
    out.push(
      `${built.battery.modules - built.battery.serials.length} battery serial${built.battery.modules - built.battery.serials.length === 1 ? "" : "s"}`,
    );
  if (!built.installedOn) out.push("the install date");
  return out;
}
