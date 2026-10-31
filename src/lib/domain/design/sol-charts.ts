/**
 * Charts Sol draws in his chat (31 Oct 2026, as Primero's: the answer compressed to what is needed, "Want more
 * detail?", and a picture where it says it quicker). A chart is kept with Sol's turn and drawn under his words. Pure,
 * tested.
 *
 * Three shapes, one series each (so one colour, the signal orange): a funnel (steps, each with its share of the first),
 * bars (things side by side) and columns (a figure over time, oldest first). Drawn only from figures a tool gave him.
 */

export type ChartKind = "funnel" | "bars" | "columns";

export interface SolChart {
  kind: ChartKind;
  title: string;
  /** What a value is counted in ("leads", "kWh", "$"), said beside the figures. */
  unit?: string;
  rows: { label: string; value: number; note?: string }[];
  /** One line under the chart: what the figures rest on. */
  note?: string;
}

export const CHARTS_PER_TURN = 3;
const ROWS_MAX = 24;

/** The line Sol ends a short answer with when there is more to tell; the chat offers it as a button. */
export const MORE_DETAIL = "Want more detail?";
export const MORE_DETAIL_ASK = "Yes, give me more detail.";

/** Whether an answer of Sol's ends by offering more detail. */
export const offersMore = (text: string) => /want (me to (give|provide|go into) )?more detail\??\s*$/i.test(text.trim());

const str = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max) : "");

/** A chart as kept and drawn, or null when it can't be drawn truthfully (no rows, a figure that isn't a number). */
export function cleanChart(raw: unknown): SolChart | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const kind: ChartKind = r.kind === "funnel" || r.kind === "columns" ? r.kind : "bars";
  const title = str(r.title, 100);
  const rows = (Array.isArray(r.rows) ? r.rows : [])
    .map((x) => (x && typeof x === "object" ? (x as Record<string, unknown>) : {}))
    .map((x) => ({ label: str(x.label, 60), value: Number(x.value), note: str(x.note, 80) }))
    .filter((x) => x.label && Number.isFinite(x.value) && x.value >= 0)
    .slice(0, ROWS_MAX)
    .map((x) => ({ label: x.label, value: Math.round(x.value * 100) / 100, ...(x.note ? { note: x.note } : {}) }));
  if (!title || !rows.length) return null;
  const unit = str(r.unit, 20);
  const note = str(r.note, 200);
  return { kind, title, rows, ...(unit ? { unit } : {}), ...(note ? { note } : {}) };
}

export function cleanCharts(raw: unknown): SolChart[] {
  return (Array.isArray(raw) ? raw : [])
    .map(cleanChart)
    .filter((c): c is SolChart => c !== null)
    .slice(0, CHARTS_PER_TURN);
}
