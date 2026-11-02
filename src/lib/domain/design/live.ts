/**
 * Live co-design (2 Nov 2026, Martin: the customer watches their roof being designed on their phone during the call,
 * switches between the designs, sees the bill change, and says which they want). The designer sends a snapshot of what
 * the customer may see, a few times a second at most; the customer's page asks for it every `LIVE_POLL_MS`. A snapshot
 * holds only what the customer may see: never a cost, margin, product code or anything of the business's. Pure,
 * tested in `live.test.ts`.
 */

/** One design as the customer sees it live. */
export interface LiveDesign {
  /** Its place among the roof's designs, so a choice names it. */
  at: number;
  name: string;
  kw: number;
  panels: number;
  panelName: string;
  batteryKwh: number;
  /** What the customer pays after the federal rebate, a live estimate; null when the business can't show prices. */
  youPay: number | null;
  /** From the customer's bill, when it is in. */
  billNow: number | null;
  billAfter: number | null;
  saving: number | null;
  payback: number | null;
  /** Each panel's outline on the roof picture, in its pixels (`ROOF_IMAGE`). */
  outlines: [number, number][][];
}

export interface LiveSnapshot {
  designs: LiveDesign[];
  /** The design the business has open. */
  active: number;
  /** The server's time it was kept. */
  at?: string;
}

/** How often the customer's page asks for the design, and the designer for the customer's choice, ms. */
export const LIVE_POLL_MS = 2000;
/** A live link stays open this long after it is started (the call), then shows that it has ended. */
export const LIVE_HOURS = 4;
/** The most a snapshot carries. */
export const LIVE_LIMITS = { designs: 10, panels: 120 } as const;

export const isLiveToken = (t: unknown): t is string => typeof t === "string" && /^[a-f0-9]{48}$/.test(t);

const num = (v: unknown, min: number, max: number): number | null =>
  typeof v === "number" && Number.isFinite(v) && v >= min && v <= max ? Math.round(v * 100) / 100 : null;
const text = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/[<>]/g, "").replace(/\s+/g, " ").trim().slice(0, max) : "");

/** A snapshot from the designer, checked: numbers in range, words short, nothing else carried. */
export function cleanLiveSnapshot(raw: unknown): LiveSnapshot {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const designs = (Array.isArray(r.designs) ? r.designs : [])
    .slice(0, LIVE_LIMITS.designs)
    .map((d): LiveDesign | null => {
      const x = (d && typeof d === "object" ? d : {}) as Record<string, unknown>;
      const at = num(x.at, 0, 20);
      if (at === null) return null;
      const outlines = (Array.isArray(x.outlines) ? x.outlines : [])
        .slice(0, LIVE_LIMITS.panels)
        .map((o) =>
          (Array.isArray(o) ? o : [])
            .slice(0, 4)
            .map((p) => (Array.isArray(p) ? [num(p[0], -2000, 3000), num(p[1], -2000, 3000)] : [null, null]))
            .filter((p): p is [number, number] => p[0] !== null && p[1] !== null),
        )
        .filter((o) => o.length === 4);
      return {
        at: Math.round(at),
        name: text(x.name, 40) || `Option ${Math.round(at) + 1}`,
        kw: num(x.kw, 0, 200) ?? 0,
        panels: Math.round(num(x.panels, 0, 1000) ?? 0),
        panelName: text(x.panelName, 80),
        batteryKwh: num(x.batteryKwh, 0, 500) ?? 0,
        youPay: num(x.youPay, 0, 1_000_000),
        billNow: num(x.billNow, -100_000, 100_000),
        billAfter: num(x.billAfter, -100_000, 100_000),
        saving: num(x.saving, -100_000, 100_000),
        payback: num(x.payback, 0, 100),
        outlines,
      };
    })
    .filter((d): d is LiveDesign => d !== null);
  const active = num(r.active, 0, 20);
  return { designs, active: active !== null && designs.some((d) => d.at === active) ? active : (designs[0]?.at ?? 0) };
}

/** The customer's choice, checked against what they were shown. */
export function cleanChoice(raw: unknown, snapshot: LiveSnapshot): number | null {
  return typeof raw === "number" && snapshot.designs.some((d) => d.at === raw) ? raw : null;
}

/** What the business sees of the customer: watching, and what they chose. */
export function liveStatusWords(s: { seenAt: string | null; choice: number | null; choiceName: string | null }, now: Date): string {
  const seen = s.seenAt ? (now.getTime() - new Date(s.seenAt).getTime()) / 1000 : null;
  const watching = seen !== null && seen < 15 ? "Watching now" : seen !== null ? "Opened the link" : "Not opened yet";
  return s.choice !== null && s.choiceName ? `${watching} · chose ${s.choiceName}` : watching;
}

/** The words under the figures on the customer's page: every figure an estimate, the proposal confirms. */
export const LIVE_NOTE =
  "Live estimates as we design together: the price is after the federal rebate (STCs), savings come from your bill and are rounded down, and nothing is guaranteed. Your proposal confirms everything before you go ahead.";
