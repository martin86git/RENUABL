/**
 * The deal's system, set out to read at a glance (8 Nov 2026, Martin: the flat list of fields was hard to read). First
 * the home (what is being put in, storeys, roof, phase), then the system a part a line: what it is, how many, and its
 * size together (solar: panel, qty, kW; battery: battery, qty, kWh). What else is known (arrays, strings, the site)
 * follows under its own heading. Built from the same lines as the deal's details, so a typed-in value shows here too.
 * Pure, tested.
 */
import type { DetailKey } from "./crm";

type Line = { key: DetailKey | string; value: string | null };

export interface SystemPart {
  name: string;
  /** The product, as the design or the deal names it. */
  product: string | null;
  /** How many, as "× 14". */
  qty: string | null;
  /** Its size: the solar's kW, the inverter's, the battery's kWh. */
  size: string | null;
  /** Anything that goes with it (a second inverter). */
  extra?: string | null;
}

export interface SystemSummary {
  home: { label: string; value: string }[];
  parts: SystemPart[];
  layout: { label: string; value: string }[];
  site: { label: string; value: string }[];
}

const PHASES: Record<string, string> = { "1": "Single phase", "2": "Two phase", "3": "Three phase" };

/** "Double" → "Double storey", "1" → "Single phase": the home's facts in a few plain words each. */
function homeWords(key: string, value: string): string {
  const v = value.trim();
  if (key === "storeys") return /storey/i.test(v) ? v : `${v} storey`;
  if (key === "roofType") return /roof/i.test(v) ? v : `${v} roof`;
  if (key === "phases") return PHASES[v] ?? (/phase/i.test(v) ? v : `${v} phase`);
  return v;
}

export function systemSummary(lines: readonly Line[]): SystemSummary {
  const get = (key: string) => lines.find((l) => l.key === key)?.value?.trim() || null;
  const qty = (key: string) => {
    const v = get(key);
    return v ? `× ${v}` : null;
  };
  const home = (
    [
      ["systemType", "System"],
      ["propertyType", "Property"],
      ["storeys", "Storeys"],
      ["roofType", "Roof"],
      ["phases", "Power"],
    ] as const
  ).flatMap(([key, label]) => {
    const v = get(key);
    return v ? [{ label, value: homeWords(key, v) }] : [];
  });
  const parts: SystemPart[] = [
    { name: "Solar", product: get("panel"), qty: qty("panelQty"), size: get("systemSize") },
    {
      name: "Inverter",
      product: get("inverter"),
      qty: qty("inverterQty"),
      size: get("inverterCapacity"),
      extra: get("additionalInverter"),
    },
    { name: "Battery", product: get("battery"), qty: qty("batteryQty"), size: get("batteryStorage") },
    { name: "EV charger", product: get("evCharger"), qty: null, size: null },
  ].filter((p) => p.product || p.qty || p.size);
  const listed = (pairs: readonly (readonly [string, string])[]) =>
    pairs.flatMap(([key, label]) => {
      const v = get(key);
      return v ? [{ label, value: v }] : [];
    });
  return {
    home,
    parts,
    layout: listed([
      ["arrays", "Arrays"],
      ["strings", "Strings"],
      ["tiltFrames", "Tilt frames"],
      ["optimisers", "Optimisers"],
    ]),
    site: listed([
      ["switchboard", "Switchboard"],
      ["distributor", "Distributor"],
      ["nmi", "NMI"],
      ["siteAccess", "Site access"],
    ]),
  };
}
