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
  /** `kwh`: the battery's whole storage, as installed (since 22 Nov 2026; older records have none). */
  battery: { model: string; modules: number; serials: string[]; kwh?: number | null } | null;
  /** The EV charger installed (since 22 Nov 2026; older records have none). */
  charger?: { model: string; serial: string } | null;
  notes: string;
  /** Who recorded it, and when (the server's time). */
  by: string;
  at: string;
}

export type AsBuiltInput = Omit<AsBuilt, "by" | "at">;

/**
 * What was to be installed: the starting point for the as-built, and what it is held against. From the roof design,
 * else (22 Nov 2026, Martin: a job with no design still needs its as-built) from the system typed on the deal.
 */
export interface Designed {
  panels: number;
  panelModel: string;
  inverters: string[];
  battery: { model: string; modules: number; kwh?: number | null } | null;
  charger?: string | null;
  /** Where the plan came from: the roof design (the default), or the system typed on the deal. */
  from?: "design" | "deal";
}

/** Nothing planned: a job with no design and no system typed on its deal still gets an as-built to fill in. */
export const NOTHING_PLANNED: Designed = { panels: 0, panelModel: "", inverters: [], battery: null, charger: null, from: "deal" };

const whole = (v: string | undefined) => {
  const n = Number.parseInt(String(v ?? "").replace(/[^\d]/g, ""), 10);
  return Number.isFinite(n) && n > 0 ? n : 0;
};
const kwhIn = (v: string | undefined) => {
  const n = Number.parseFloat(String(v ?? "").replace(/[^\d.]/g, ""));
  return Number.isFinite(n) && n > 0 ? Math.round(n * 10) / 10 : null;
};

/**
 * The plan as the deal's own system details say it (the lines typed on the deal), for a job with no roof design.
 * Null when the deal says nothing about the system.
 */
export function plannedFromDetails(details: Record<string, string> = {}): Designed | null {
  const d = (k: string) => (details[k] ?? "").trim();
  const inverters: string[] = [];
  if (d("inverter")) for (let i = 0; i < Math.max(1, whole(d("inverterQty"))); i++) inverters.push(d("inverter"));
  if (d("additionalInverter")) inverters.push(d("additionalInverter"));
  const kwh = kwhIn(d("batteryStorage"));
  const battery =
    d("battery") || d("batteryQty") || kwh ? { model: d("battery"), modules: whole(d("batteryQty")) || (kwh ? 1 : 0), kwh } : null;
  const plan: Designed = {
    panels: whole(d("panelQty")),
    panelModel: d("panel"),
    inverters,
    battery,
    charger: d("evCharger") || null,
    from: "deal",
  };
  return plan.panels || plan.panelModel || inverters.length || battery || plan.charger ? plan : null;
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
  const c = r.charger && typeof r.charger === "object" ? (r.charger as Record<string, unknown>) : null;
  const kwhOf = (v: unknown) => (typeof v === "number" && Number.isFinite(v) && v > 0 && v <= 2000 ? Math.round(v * 10) / 10 : null);
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
      b && (text(b.model, 120) || serialsOf(b.serials).length || count(b.modules, 40) || kwhOf(b.kwh))
        ? { model: text(b.model, 120), modules: count(b.modules, 40), serials: serialsOf(b.serials), kwh: kwhOf(b.kwh) }
        : null,
    charger:
      c && (text(c.model, 120) || serialsOf(c.serial).length) ? { model: text(c.model, 120), serial: serialsOf(c.serial)[0] ?? "" } : null,
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
    battery: designed.battery
      ? { model: designed.battery.model, modules: designed.battery.modules, serials: [], kwh: designed.battery.kwh ?? null }
      : null,
    charger: designed.charger ? { model: designed.charger, serial: "" } : null,
    notes: "",
  };
}

const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

/** How what was installed differs from the design, in words; empty when it was built as designed. */
export function asBuiltDifferences(built: AsBuiltInput, designed: Designed): string[] {
  const out: string[] = [];
  const word = designed.from === "deal" ? "planned" : "designed";
  if (built.panels.count !== designed.panels) out.push(`Panels: ${designed.panels} ${word}, ${built.panels.count} installed.`);
  if (built.panels.model && designed.panelModel && !same(built.panels.model, designed.panelModel))
    out.push(`Panel: ${word} ${designed.panelModel}, installed ${built.panels.model}.`);
  const builtInv = built.inverters.map((i) => i.model).filter(Boolean);
  if (builtInv.length !== designed.inverters.length || builtInv.some((m, i) => !same(m, designed.inverters[i] ?? "")))
    out.push(`Inverter: ${word} ${designed.inverters.join(", ") || "none"}, installed ${builtInv.join(", ") || "none"}.`);
  const bd = designed.battery;
  const bb = built.battery;
  if (!bd && bb) out.push(`Battery: none ${word}, ${bb.modules} × ${bb.model} installed.`);
  else if (bd && !bb) out.push(`Battery: ${bd.modules} × ${bd.model} ${word}, none installed.`);
  else if (bd && bb && (bd.modules !== bb.modules || !same(bd.model, bb.model)))
    out.push(`Battery: ${word} ${bd.modules} × ${bd.model}, installed ${bb.modules} × ${bb.model}.`);
  const bc = designed.charger ?? null;
  const cc = built.charger?.model || null;
  if (bc && !built.charger) out.push(`EV charger: ${bc} ${word}, none installed.`);
  else if (!bc && cc) out.push(`EV charger: none ${word}, ${cc} installed.`);
  else if (bc && cc && !same(bc, cc)) out.push(`EV charger: ${word} ${bc}, installed ${cc}.`);
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
  if (built.charger && !built.charger.serial) out.push("the EV charger's serial");
  if (!built.installedOn) out.push("the install date");
  return out;
}

/** What was installed, in words, as Sol reads it for service: the models and every serial. */
export function asBuiltInWords(b: AsBuilt): string {
  return [
    `As built (recorded ${b.at.slice(0, 10)} by ${b.by.split("@")[0]})${b.installedOn ? `, installed ${b.installedOn}` : ""}:`,
    `Panels: ${b.panels.count} × ${b.panels.model || "model not given"}${b.panelSerials.length ? `; serials ${b.panelSerials.join(", ")}` : "; no serials recorded"}`,
    ...b.inverters.map((i) => `Inverter: ${i.model || "model not given"}${i.serial ? `, serial ${i.serial}` : ", no serial recorded"}`),
    ...(b.battery
      ? [
          `Battery: ${b.battery.model || "model not given"}${b.battery.kwh ? `, ${b.battery.kwh} kWh` : ""}, ${b.battery.modules} module${b.battery.modules === 1 ? "" : "s"}${b.battery.serials.length ? `; serials ${b.battery.serials.join(", ")}` : "; no serials recorded"}`,
        ]
      : []),
    ...(b.charger
      ? [`EV charger: ${b.charger.model || "model not given"}${b.charger.serial ? `, serial ${b.charger.serial}` : ", no serial recorded"}`]
      : []),
    ...(b.notes ? [`Notes: ${b.notes}`] : []),
  ].join("\n");
}

/**
 * What was installed, as the job card's System lines (22 Nov 2026, Martin: the card keeps what was really installed,
 * the reference for the system a customer has). Only what was recorded; serials are counted, not listed.
 */
export function asBuiltLines(b: AsBuiltInput): { label: string; value: string }[] {
  const out: { label: string; value: string }[] = [];
  if (b.installedOn) out.push({ label: "Installed on", value: b.installedOn });
  if (b.panels.count || b.panels.model) out.push({ label: "Panels", value: `${b.panels.count} × ${b.panels.model || "model not given"}` });
  b.inverters.forEach((i, n) =>
    out.push({
      label: b.inverters.length > 1 ? `Inverter ${n + 1}` : "Inverter",
      value: `${i.model || "model not given"}${i.serial ? ` · S/N ${i.serial}` : ""}`,
    }),
  );
  if (b.battery)
    out.push({
      label: "Battery",
      value: [
        b.battery.model || "model not given",
        b.battery.kwh ? `${b.battery.kwh} kWh` : "",
        b.battery.modules ? `${b.battery.modules} module${b.battery.modules === 1 ? "" : "s"}` : "",
      ]
        .filter(Boolean)
        .join(" · "),
    });
  if (b.charger)
    out.push({
      label: "EV charger",
      value: `${b.charger.model || "model not given"}${b.charger.serial ? ` · S/N ${b.charger.serial}` : ""}`,
    });
  const serials = b.panelSerials.length + (b.battery?.serials.length ?? 0);
  if (serials)
    out.push({ label: "Serials kept", value: `${b.panelSerials.length} panel${b.battery ? `, ${b.battery.serials.length} battery` : ""}` });
  return out;
}
