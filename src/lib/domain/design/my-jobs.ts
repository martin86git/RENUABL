/**
 * An installer's My Jobs (2 Nov 2026, Martin: the installer's home is My Jobs, with Today / Tomorrow / This week /
 * This month, each job shown with its roof and what the crew needs: the retailer, the address, the customer, the
 * system with its sizes, each product as qty × make and model, the storeys and roof profile, and where the equipment
 * is collected with its order number). Built from the job card the retailer shares and its order; never a price, and
 * never the customer's email. Pure, tested.
 */
import type { ISODate } from "../types";
import type { JobDrawing } from "./job-card";

export const JOB_PERIODS = [
  { id: "today", label: "Today" },
  { id: "tomorrow", label: "Tomorrow" },
  { id: "week", label: "This week" },
  { id: "month", label: "This month" },
] as const;
export type JobPeriod = (typeof JOB_PERIODS)[number]["id"];

export const cleanPeriod = (raw: unknown): JobPeriod => JOB_PERIODS.find((p) => p.id === raw)?.id ?? "today";

const at = (iso: ISODate) => new Date(`${iso}T00:00:00Z`);
const iso = (d: Date) => d.toISOString().slice(0, 10) as ISODate;
const plus = (day: ISODate, n: number) => {
  const d = at(day);
  d.setUTCDate(d.getUTCDate() + n);
  return iso(d);
};

/** The days a period covers, from and to inclusive: a week runs Monday to Sunday, a month the whole calendar month. */
export function periodDays(period: JobPeriod, today: ISODate): { from: ISODate; to: ISODate } {
  if (period === "today") return { from: today, to: today };
  if (period === "tomorrow") return { from: plus(today, 1), to: plus(today, 1) };
  if (period === "week") {
    const monday = plus(today, -((at(today).getUTCDay() + 6) % 7));
    return { from: monday, to: plus(monday, 6) };
  }
  const first = `${today.slice(0, 7)}-01` as ISODate;
  const next = at(first);
  next.setUTCMonth(next.getUTCMonth() + 1);
  return { from: first, to: plus(iso(next), -1) };
}

export const inPeriod = (date: string | null, period: JobPeriod, today: ISODate) => {
  if (!date) return false;
  const { from, to } = periodDays(period, today);
  return date >= from && date <= to;
};

/** One wholesaler a job's equipment is collected from: its name, the number to collect against and where it is. */
export interface Collection {
  wholesaler: string;
  /** The wholesaler's own sales order number, else the business's purchase order reference; "" when neither is set. */
  order: string;
  address: string | null;
}

/** One product to install: how many and its make and model. */
export interface KitLine {
  kind: "panel" | "inverter" | "battery";
  qty: number;
  model: string;
}

/** A job as the installer's My Jobs shows it. */
export interface JobSheet {
  /** The share's id: the way into the job card. */
  id: string;
  retailer: string;
  address: string;
  customer: { name: string; phone: string };
  installDate: string | null;
  /** Where the roof is, for its picture; null without a design. */
  roof: { lat: number; lng: number } | null;
  /** The panel layout drawn over the roof picture (INV, BAT and MSB where the design puts them); null without a design. */
  layout: JobDrawing | null;
  solarKw: number | null;
  batteryKwh: number | null;
  ev: boolean;
  kit: KitLine[];
  storeys: string | null;
  roofProfile: string | null;
  collection: Collection[];
}

const value = (details: readonly { label: string; value: string }[], label: string) =>
  details.find((d) => d.label === label)?.value?.trim() || null;
const number = (s: string | null) => {
  const n = s ? Number.parseFloat(s.replace(/[^\d.]/g, "")) : NaN;
  return Number.isFinite(n) && n > 0 ? n : null;
};
const count = (s: string | null) => {
  const n = number(s);
  return n ? Math.round(n) : 1;
};

/** The roof profile in the installer's words: Tin, Flat, Klip-lok or Tile (Klip-lok when it was typed so). */
export function roofProfile(roofType: string | null): string | null {
  if (!roofType) return null;
  const r = roofType.toLowerCase();
  if (/klip|kliplok|klip-lok/.test(r)) return "Klip-lok";
  if (/tile|terracotta|concrete/.test(r)) return "Tile";
  if (/flat/.test(r)) return "Flat";
  if (/tin|colorbond|corrugated|metal/.test(r)) return "Tin";
  return roofType.trim();
}

/** The storeys in words: "Single storey" or "Double storey". */
export function storeysWords(storeys: string | null): string | null {
  if (!storeys) return null;
  if (/double|two|2/i.test(storeys)) return "Double storey";
  if (/single|one|1/i.test(storeys)) return "Single storey";
  return storeys.trim();
}

/**
 * The products to install, as qty × model: from the design when there is one (the panels drawn, each inverter, the
 * battery's modules), else from what was typed on the deal. Inverters of the same model are counted together.
 */
export function kitLines(
  designed: { panels: number; panelModel: string; inverters: string[]; battery: { model: string; modules: number } | null } | null,
  details: readonly { label: string; value: string }[],
): KitLine[] {
  const lines: KitLine[] = [];
  if (designed) {
    if (designed.panels && designed.panelModel) lines.push({ kind: "panel", qty: designed.panels, model: designed.panelModel });
    const inverters = new Map<string, number>();
    for (const name of designed.inverters.filter(Boolean)) inverters.set(name, (inverters.get(name) ?? 0) + 1);
    for (const [model, qty] of inverters) lines.push({ kind: "inverter", qty, model });
    if (designed.battery?.model) lines.push({ kind: "battery", qty: designed.battery.modules || 1, model: designed.battery.model });
    return lines;
  }
  const panel = value(details, "PV panel");
  if (panel) lines.push({ kind: "panel", qty: count(value(details, "Panel qty")), model: panel });
  const inverter = value(details, "Inverter");
  if (inverter) lines.push({ kind: "inverter", qty: count(value(details, "Inverter qty")), model: inverter });
  const battery = value(details, "Battery");
  if (battery) lines.push({ kind: "battery", qty: count(value(details, "Battery qty")), model: battery });
  return lines;
}

/**
 * Where the job's equipment is collected: each wholesaler on the order (items with no supplier left out), with its
 * sales order number, else the business's purchase order reference, and its collection point when one is marked.
 */
export function collectionOf(
  groups: readonly { list: string | null; supplier: string | null }[],
  order: { reference: string; salesOrders?: Record<string, string> },
  places: Record<string, { address: string }>,
): Collection[] {
  return groups
    .filter((g): g is { list: string; supplier: string } => Boolean(g.list && g.supplier))
    .map((g) => ({
      wholesaler: g.supplier,
      order: order.salesOrders?.[g.list]?.trim() || order.reference.trim(),
      address: places[g.supplier]?.address ?? null,
    }));
}

/** A job sheet from the job card the retailer shares and its order's collection. */
export function jobSheet(input: {
  id: string;
  retailer: string;
  card: {
    job: { address: string; installDate: string | null };
    customer: { name: string; phone: string };
    details: readonly { label: string; value: string }[];
    roof: { lat: number; lng: number } | null;
    layout?: JobDrawing | null;
    designed: Parameters<typeof kitLines>[0];
  };
  collection: Collection[];
}): JobSheet {
  const { card } = input;
  const ev = value(card.details, "EV charger");
  return {
    id: input.id,
    retailer: input.retailer,
    address: card.job.address,
    customer: { name: card.customer.name, phone: card.customer.phone },
    installDate: card.job.installDate,
    roof: card.roof,
    layout: card.layout ?? null,
    solarKw: number(value(card.details, "System size")),
    batteryKwh: number(value(card.details, "Battery storage")),
    ev: Boolean(ev && !/^(no|none|n\/a|-+)$/i.test(ev)),
    kit: kitLines(card.designed, card.details),
    storeys: storeysWords(value(card.details, "Property storeys")),
    roofProfile: roofProfile(value(card.details, "Roof type")),
    collection: input.collection,
  };
}

/** The sheets a period shows, soonest first; jobs with no day yet are listed apart (`undated`). */
export function sheetsFor(sheets: readonly JobSheet[], period: JobPeriod, today: ISODate): { shown: JobSheet[]; undated: JobSheet[] } {
  return {
    shown: sheets.filter((s) => inPeriod(s.installDate, period, today)).sort((a, b) => a.installDate!.localeCompare(b.installDate!)),
    undated: sheets.filter((s) => !s.installDate),
  };
}

/** What a period says when it has no jobs. */
export function emptyWords(period: JobPeriod): string {
  return period === "today"
    ? "No installations today."
    : period === "tomorrow"
      ? "No installations tomorrow."
      : period === "week"
        ? "No installations this week."
        : "No installations this month.";
}
