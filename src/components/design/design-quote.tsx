"use client";

import clsx from "clsx";
import { ArrowRight, BadgeCheck, ChevronDown, ChevronLeft, ChevronRight, LayoutGrid, Plus, Rows3, Wrench, Zap } from "lucide-react";
import { BatteryIcon, ChargerIcon, InverterIcon, PanelIcon } from "./deal-banner";
import Link from "next/link";
import { createPortal } from "react-dom";
import { useEffect, useState } from "react";
import type { Workspace } from "@/lib/domain/design/pricing";
import { PriceCart } from "./price-cart";
import {
  COST_GROUPS,
  costSystem,
  editedLines,
  undecidedLines,
  editOf,
  lineKey,
  withOwnKey,
  MAX_LINE_QTY,
  MAX_RATE_PER_WATT,
  centsWords,
  MARGIN_KEY,
  MAX_ADDED_LABEL,
  MAX_ADDED_LINES,
  addedKey,
  addedLines,
  quoteTotals,
  solarVicBar,
  solarVicFor,
  solarVicNote,
  stcValue,
  type CostLine,
  type LineEdit,
  type QuoteFields,
  type SystemSpec,
} from "@/lib/domain/design/quote";
import { todayInMarket } from "@/lib/domain/market";
import type { RebateRates } from "@/lib/domain/rebates";
import { priceAdvice, typedCostFlags, type Advice } from "@/lib/domain/design/price-check";
import { usePricePoints } from "@/lib/services/price-check";
import { askSolInPanel } from "@/lib/services/sol";
import { SolBadge } from "./sol-sun";

const FOLDED_KEY = "renuabl.design.quote-folded";
type GroupIcon = (props: { className?: string }) => React.ReactNode;
/** Each section's mark on its strip: the deal banner's own drawings for the kit, plain marks for the rest. */
const GROUP_ICONS: Record<(typeof COST_GROUPS)[number], GroupIcon> = {
  Panels: PanelIcon,
  Inverters: InverterIcon,
  Battery: BatteryIcon,
  "EV charger": ChargerIcon,
  Racking: Rows3,
  Electrical: Zap,
  Switchboard: LayoutGrid,
  Installation: Wrench,
  Commission: BadgeCheck,
};

/**
 * Beside the quote, a section's costs decided on each job in one quiet line (19 Nov 2026, Martin: they were in the
 * list and in the panel beside it, twice): what is included and its sum, what is left out, what is still to decide.
 */
function DecidedLine({ lines, edits }: { lines: CostLine[]; edits: Record<string, LineEdit> }) {
  const on = lines.filter((l) => editOf(edits, l)?.on);
  const out = lines.filter((l) => editOf(edits, l)?.removed);
  const open = lines.filter((l) => !editOf(edits, l)?.on && !editOf(edits, l)?.removed);
  const sum = editedLines(on, edits).reduce((t, l) => t + l.amount, 0);
  const names = (ls: CostLine[]) => ls.map((l) => l.label.toLowerCase()).join(", ");
  return (
    <p className="space-x-2 px-3 py-1 text-[11px] leading-snug text-muted">
      {on.length > 0 && (
        <span>
          <span className="font-semibold tabular-nums text-ink-2">+{money(sum)}</span> decided on this job: {names(on)}.
        </span>
      )}
      {out.length > 0 && <span>Left out, may apply: {names(out)}.</span>}
      {open.length > 0 && <span className="font-medium text-sun-ink">To decide beside the quote: {names(open)}.</span>}
    </p>
  );
}

const money = (n: number) => (n < 0 ? "-$" : "$") + Math.abs(Math.round(n)).toLocaleString("en-AU");
const label = "text-[10px] font-medium uppercase tracking-[0.14em] text-muted";

/**
 * The quote for the design beside it, worked out again each time the design
 * changes: the panels drawn, in the panel chosen; the inverters and the
 * battery chosen; racking for that many panels; and installation (so many
 * cents a watt, the storeys, arrays counted from the drawing, tilt frames for
 * tilted panels on a flat roof). Costed from the business's own price lists
 * and settings (`quote.ts`).
 *
 * Any line can be changed by hand: its cost typed over, or the line taken
 * out. A line changed by hand keeps what was typed while the design changes
 * under it, and is marked so, with the way back to the worked-out figure.
 */
/**
 * A box clicked into has its figure picked whole, so typing replaces it (18 Nov 2026, Martin: it took a double click to
 * pick the value and type over it). The click's own mouse-up would put the cursor back in, so that one is let go.
 */
let picked: HTMLInputElement | null = null;
const pickWhole = {
  onFocus: (e: React.FocusEvent) => {
    const t = e.target;
    if (!(t instanceof HTMLInputElement) || t.type === "checkbox" || t.type === "radio") return;
    t.select();
    picked = t;
  },
  onMouseUp: (e: React.MouseEvent) => {
    if (picked && e.target === picked) e.preventDefault();
    picked = null;
  },
};

export function DesignQuote(props: {
  /** Roof, storeys and phase already answered elsewhere (Sol's guide), so the home box doesn't ask to be checked. */
  homeSettled?: boolean;
  /** Which of the roof's designs this is: "Design 2". */
  design: string;
  /** Flicking between the roof's designs from the quote (8 Nov 2026, Martin): the one before, and the next. */
  onDesign?: (step: -1 | 1) => void;
  spec: SystemSpec;
  workspace: Workspace;
  rates: RebateRates;
  /** This design's quote settings and the lines changed by hand: kept by the designer, and saved with the design. */
  value: QuoteFields;
  onChange: (next: QuoteFields) => void;
  /** The price after STCs, each time it is worked out; null when there is nothing to price. For the summary over the picture. */
  onNet: (net: number | null) => void;
  /**
   * The short view (Martin: more room for the picture): smaller type, each group's total instead of its lines, and the
   * price, with a way back to every line. The quote is worked out the same either way.
   */
  compact?: boolean;
  /** Laid out across a wide space: the groups side by side, the totals beside them. */
  wide?: boolean;
  onCompact?: (compact: boolean) => void;
  /** The home's roof, storeys and phase are shown elsewhere (the design tool's Designer view), so not here. */
  homeless?: boolean;
  /**
   * The next step once the quote is right (15 Nov 2026, Martin: the designer leads on from the quote to the proposal).
   * Shown under the totals; held back while a cost decided on each job is still to decide.
   */
  onProceed?: () => void;
  /** What came of pressing Proceed, when it didn't go on (a save refused, no deal). */
  proceedSaid?: string | null;
  /** The workspace once a price list or a price is kept from the cart, so the quote is costed with it at once. */
  onWorkspace?: (next: Workspace) => void;
}) {
  const { form, edits } = props.value;
  const { spec, workspace, rates } = props;
  // The cart: upload a price list, or set a price for each part with none on file (18 Nov 2026, Martin).
  const [cartOpen, setCartOpen] = useState(false);
  // Sections folded to their strip, kept on the device (19 Nov 2026, Martin).
  const [folded, setFolded] = useState<string[]>([]);
  useEffect(() => {
    try {
      const kept = JSON.parse(localStorage.getItem(FOLDED_KEY) ?? "[]");
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (Array.isArray(kept)) setFolded(kept.filter((g): g is string => typeof g === "string"));
    } catch {
      // No storage: every section opens.
    }
  }, []);
  const fold = (group: string) =>
    setFolded((now) => {
      const next = now.includes(group) ? now.filter((g) => g !== group) : [...now, group];
      try {
        localStorage.setItem(FOLDED_KEY, JSON.stringify(next));
      } catch {
        // Kept for the visit only.
      }
      return next;
    });
  const empty = spec.panels === 0;
  const costing = costSystem(spec, form, workspace);
  const stc = stcValue(costing, /^\d{4}$/.test(form.postcode) ? form.postcode : null, todayInMarket(), rates, workspace.settings.stcPrice);

  const all = costing.lines;
  // Every hand change: lines typed over or taken out, lines of the business's own, the margin typed over.
  const totals = quoteTotals(costing, edits);
  const lines = totals.lines;
  const added = addedLines(edits);
  const marginTyped = edits[MARGIN_KEY]?.amount !== undefined;
  // Hand changes, not counting the costs decided on each job (those are decisions, not changes).
  const changed = all.filter((l) => editOf(edits, l) && !l.confirm).length;
  const removed = all.filter((l) => editOf(edits, l)?.removed && !l.confirm).length;
  // Costs that sometimes apply, not yet included or left out: nothing is published until each is decided.
  const undecided = undecidedLines(all, edits);
  const missing = lines.filter((l) => l.missing).length;
  const net = empty ? null : totals.priceIncGst - stc;
  // Sol's price check (18 Nov 2026, Martin): by rule, from the business's own proposals, the quote's own deal left out.
  const points = usePricePoints(!empty);
  // The deal the designer is open on (its own proposal isn't compared with itself). Only read in the browser, where the
  // history it filters arrives; on the server there is none, so nothing differs.
  const jobId = typeof window === "undefined" ? null : new URLSearchParams(window.location.search).get("job");
  const marginShare = totals.priceExGst > 0 ? totals.margin / totals.priceExGst : 0;
  const advice =
    empty || net === null
      ? []
      : priceAdvice(
          { kw: costing.pvKw, batteryKwh: costing.batteryKwh ?? 0, youPay: net, marginShare },
          points,
          workspace.settings.margin.floor ?? 0,
          new Date(),
          jobId,
        );
  const typedFlags = typedCostFlags(all, edits, jobId ? points.filter((p) => p.jobId !== jobId) : points);
  const underFloor = advice.find((a) => a.text.includes("floor"));
  // Solar Victoria, when it has been put on this quote: always "if approved".
  const solarVic = empty ? null : solarVicFor(form, costing.panels, totals.priceIncGst, stc, rates);
  const solarVicOff = solarVicBar(form, costing.panels, rates);
  // Whether the Solar Victoria switches were touched on this visit: Proceed asks about them only when they weren't
  // (19 Nov 2026, Martin: "only when i haven't engaged with the toggles, meaning i could have potentially overlooked it").
  const [vicTouched, setVicTouched] = useState(false);
  const [vicAsk, setVicAsk] = useState(false);
  const setSolarVic = (rebate: boolean, loan: boolean) => {
    setVicTouched(true);
    // The loan goes with the rebate: switching the loan on switches the rebate on, and switching the rebate off takes the loan too.
    props.onChange({ form: { ...form, solarVicRebate: rebate || loan, solarVicLoan: loan && (rebate || loan) }, edits });
  };
  // What the rebate would take off, to say in the question (only where it can apply at all).
  const vicMaybe =
    empty || solarVicOff ? null : solarVicFor({ ...form, solarVicRebate: true }, costing.panels, totals.priceIncGst, stc, rates);
  const proceedNow = () => {
    if (vicMaybe && !vicTouched && !form.solarVicRebate && !form.solarVicLoan) return setVicAsk(true);
    props.onProceed?.();
  };
  // Answered from the question: the switches as chosen, then on to the proposal once the quote has them.
  const vicChoose = (rebate: boolean, loan: boolean) => {
    setVicAsk(false);
    if (rebate || loan) setSolarVic(rebate, loan);
    else setVicTouched(true);
    const go = props.onProceed;
    window.setTimeout(() => go?.(), rebate || loan ? 120 : 0);
  };
  const proceedBox = props.onProceed && !empty && (
    <div className="mt-3 border-t border-line pt-3">
      {underFloor && (
        <p className="mb-2 rounded-md bg-warning-soft px-2.5 py-1.5 text-center text-xs text-warning" role="status">
          {underFloor.text} You can still go ahead.
        </p>
      )}
      <button
        type="button"
        onClick={proceedNow}
        disabled={undecided.length > 0}
        className={clsx(
          "flex w-full items-center justify-center gap-2 rounded-full px-4 py-2.5 text-sm font-semibold",
          undecided.length > 0
            ? "bg-surface-2 text-muted"
            : "bg-sun-line text-white shadow-[0_6px_18px_rgba(255,90,31,0.3)] hover:brightness-105",
        )}
      >
        Proceed to proposal <ArrowRight className="size-4" aria-hidden />
      </button>
      {props.proceedSaid && (
        <p className="mt-1.5 rounded-md bg-warning-soft px-2.5 py-1.5 text-center text-xs text-warning" role="status">
          {props.proceedSaid}
        </p>
      )}
      <p className="mt-1.5 text-center text-[11px] text-muted">
        {undecided.length > 0
          ? `Decide on ${undecided.length === 1 ? "the cost" : `the ${undecided.length} costs`} above first.`
          : "Saves the design, then opens the proposal to check and send."}
      </p>
      {vicAsk && vicMaybe && <SolarVicAsk rebate={vicMaybe.rebate} onChoose={vicChoose} onClose={() => setVicAsk(false)} />}
    </div>
  );
  const { onNet } = props;
  useEffect(() => onNet(net), [onNet, net]);

  /** Changes a line by hand: a quantity and a cost typed over it sit together; null puts the line back as worked out. */
  const edit = (l: CostLine, to: LineEdit | null) => {
    // An edit kept under the line's older key becomes its own first (`withOwnKey`).
    const next = { ...withOwnKey(edits, l, all) };
    const key = lineKey(l);
    if (!to) delete next[key];
    else if (to.removed) next[key] = { removed: true };
    else {
      next[key] = { ...next[key], ...to };
      // Included again after being left out.
      if (to.on) delete next[key].removed;
    }
    props.onChange({ form, edits: next });
  };
  /** Changes or takes away an edit kept by its key (the margin, a line of the business's own). */
  const setKey = (key: string, to: LineEdit | null) => {
    const next = { ...edits };
    if (to) next[key] = to;
    else delete next[key];
    props.onChange({ form, edits: next });
  };
  const setMargin = (dollars: number | null) =>
    setKey(MARGIN_KEY, dollars === null ? null : { amount: Math.max(0, Math.min(1_000_000, Math.round(dollars))) });
  const marginPct = totals.priceExGst > 0 ? Math.round((totals.margin / totals.priceExGst) * 100) : 0;
  /** The margin for a share of the price ex GST (a price is cost plus margin). */
  const setMarginPct = (pct: number) => {
    const p = Math.max(0, Math.min(90, pct));
    setMargin((totals.cost * p) / (100 - p));
  };
  const addLine = () => setKey(addedKey(), { label: "New line", group: "Installation", qty: 1, amount: 0 });
  const numberBox = (typed: boolean) =>
    `rounded-md border bg-surface px-1 py-0.5 text-right tabular-nums outline-none [appearance:textfield] focus:border-forest [&::-webkit-inner-spin-button]:appearance-none ${
      typed ? "border-sun-line font-semibold text-ink" : "border-line hover:border-ink-2"
    }`;

  if (props.compact) {
    const priced = editedLines(all, edits);
    return (
      <section className="rounded-lg border border-line bg-surface p-2.5 text-[11px]" aria-label="Quote builder, short view" {...pickWhole}>
        <div className="flex items-center justify-between gap-1">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-2">Quote · {props.design}</p>
          {props.onCompact && (
            <button
              className="rounded-md px-1.5 py-0.5 text-[11px] font-medium text-ink-2 underline underline-offset-2 hover:text-ink"
              onClick={() => props.onCompact?.(false)}
              title="Show every line, and the home's roof, storeys and phase"
            >
              Every line
            </button>
          )}
        </div>
        {empty ? (
          <p className="mt-2 text-ink-2">Put panels on the roof and they appear here, costed as you go.</p>
        ) : (
          <>
            {undecided.length > 0 && (
              <button
                className="mt-2 block w-full rounded-md bg-sun px-2 py-1.5 text-left text-sun-ink"
                onClick={() => props.onCompact?.(false)}
              >
                {undecided.length} {undecided.length === 1 ? "cost" : "costs"} to decide on: open every line
              </button>
            )}
            {missing > 0 && (
              <button
                className="mt-2 block w-full rounded-md bg-warning-soft px-2 py-1.5 text-left text-warning"
                onClick={() => props.onCompact?.(false)}
              >
                {missing} {missing === 1 ? "line has" : "lines have"} no cost on file: open every line
              </button>
            )}
            <dl className="mt-2 space-y-0.5">
              {COST_GROUPS.map((group) => {
                const rows = priced.filter((l) => l.group === group);
                if (!rows.length) return null;
                return (
                  <div key={group} className="flex justify-between gap-2">
                    <dt className="truncate text-ink-2">{group}</dt>
                    <dd className="tabular-nums">{money(rows.reduce((t, l) => t + l.amount, 0))}</dd>
                  </div>
                );
              })}
            </dl>
            <dl className="mt-2 space-y-0.5 border-t border-line pt-2">
              {[
                ["Cost", money(totals.cost)],
                ["Margin", money(totals.margin)],
                ["Price inc. GST", money(totals.priceIncGst)],
                ["After STCs", money(totals.priceIncGst - stc)],
              ].map(([k, v], i) => (
                <div key={k} className={i >= 2 ? "flex justify-between font-semibold text-ink" : "flex justify-between text-ink-2"}>
                  <dt>{k}</dt>
                  <dd className="tabular-nums">{v}</dd>
                </div>
              ))}
              {solarVic && (
                <div className="flex justify-between text-sun-ink">
                  <dt>After Solar Vic, if approved</dt>
                  <dd className="tabular-nums">{money(solarVic.afterRebate)}</dd>
                </div>
              )}
            </dl>
            <p className="mt-2 text-[10px] leading-snug text-muted">
              {costing.panels} panels, {costing.pvKw} kW{costing.batteryKwh ? `, ${costing.batteryKwh} kWh` : ""}. Costs ex GST
              {changed ? `; ${changed} changed by hand` : ""}.
            </p>
          </>
        )}
      </section>
    );
  }

  // Laid out across a wide space: the lines down one side, everything to switch or decide beside them (8 Nov 2026, Martin).
  const split = Boolean(props.wide) && !empty;
  const confirms = all.filter((l) => l.confirm);
  const homeBox = (
    <div className="mt-2.5">
      <HomeToggles
        form={form}
        settled={props.homeSettled}
        onPick={(name, value) => props.onChange({ form: { ...form, [name]: value } as QuoteFields["form"], edits })}
      />
    </div>
  );
  const solarVicBox = (
    <div className="mt-2 rounded-md border border-line bg-canvas px-2 py-1.5" role="group" aria-label="Solar Victoria">
      <div className="flex items-center gap-3 text-[11px] font-medium text-ink">
        <span className="whitespace-nowrap text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-2">Solar Vic</span>
        {(
          [
            ["Rebate", Boolean(form.solarVicRebate), (on: boolean) => setSolarVic(on, on && Boolean(form.solarVicLoan))],
            ["Loan", Boolean(form.solarVicLoan), (on: boolean) => setSolarVic(Boolean(form.solarVicRebate) || on, on)],
          ] as const
        ).map(([name, on, set]) => (
          <label
            key={name}
            className="flex cursor-pointer items-center gap-1.5"
            title={`Solar Victoria ${name.toLowerCase()}: subject to eligibility and approval`}
          >
            <span className="relative inline-flex shrink-0">
              <input
                type="checkbox"
                role="switch"
                aria-label={`Solar Victoria ${name.toLowerCase()}`}
                className="peer sr-only"
                checked={on}
                onChange={(e) => set(e.target.checked)}
              />
              <span className="h-4 w-7 rounded-full bg-line-strong peer-checked:bg-sun-line peer-focus-visible:ring-2 peer-focus-visible:ring-ink" />
              <span className="absolute left-0.5 top-0.5 size-3 rounded-full bg-surface shadow-[var(--shadow-soft)] peer-checked:translate-x-3" />
            </span>
            {name}
          </label>
        ))}
        <span className="ml-auto whitespace-nowrap text-[10px] text-muted">If approved</span>
      </div>
      {form.solarVicRebate && solarVicOff && <p className="mt-1 text-[11px] text-sun-ink">{solarVicOff} Nothing is added to this quote.</p>}
    </div>
  );
  // The lines, a card a section (19 Nov 2026, Martin: "fit more into view… the sections are also not that easily
  // distinguishable"): one line an item with its code beside it, each section's icon, count and subtotal in a tinted
  // strip that folds it away, the column headings once at the top, and the take-out cross only on hover. Beside the
  // quote, the costs decided on each job are one quiet line under their section; their switches are in the panel.
  const priced = editedLines(all, edits);
  // Item, how many, the cost of one, and the line's total: how many times the cost each (21 Nov 2026, Martin).
  const cols = "grid grid-cols-[minmax(0,1fr)_3.25rem_5.25rem_5rem_1.25rem] items-center gap-x-2";
  const tableBlock = (
    <>
      <div
        className={clsx(cols, "sticky top-0 z-10 bg-surface px-3 pb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted")}
        aria-hidden
      >
        <span>Item</span>
        <span className="text-right">Qty</span>
        <span className="text-right">Each ex GST</span>
        <span className="text-right">Total</span>
        <span />
      </div>
      <div className="space-y-2">
        {COST_GROUPS.map((group) => {
          // A cost decided on each job stays in the list when left out, so it can be included again (beside the quote,
          // it is summed up in one line instead).
          const rows = all.filter((l) => l.group === group && (l.confirm ? !split : !editOf(edits, l)?.removed));
          const decided = split ? all.filter((l) => l.group === group && l.confirm) : [];
          if (!rows.length && !decided.length) return null;
          const subtotal = priced.filter((l) => l.group === group).reduce((t, l) => t + l.amount, 0);
          const shut = folded.includes(group);
          const Icon = GROUP_ICONS[group];
          const flagged = rows.some((l) => l.missing && editOf(edits, l)?.amount === undefined && editOf(edits, l)?.each === undefined);
          return (
            <section key={group} className="overflow-hidden rounded-lg border border-line" aria-label={group}>
              <button
                type="button"
                onClick={() => fold(group)}
                aria-expanded={!shut}
                className="flex w-full items-center gap-2 bg-canvas px-3 py-1.5 text-left hover:bg-surface-2"
              >
                <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-surface text-ink ring-1 ring-line">
                  <Icon className="size-3.5" aria-hidden />
                </span>
                <span className="text-[13px] font-semibold text-ink">{group}</span>
                <span className="text-[11px] text-muted">
                  {rows.length} {rows.length === 1 ? "line" : "lines"}
                </span>
                {flagged && <span className="rounded-full bg-warning-soft px-1.5 text-[10px] font-semibold text-warning">No cost</span>}
                <span className="ml-auto text-[13px] font-semibold tabular-nums text-ink">{money(subtotal)}</span>
                <ChevronDown className={clsx("size-4 shrink-0 text-muted transition-transform", shut && "-rotate-90")} aria-hidden />
              </button>
              {!shut && (
                <div className="divide-y divide-line border-t border-line">
                  {rows.map((l, i) => {
                    const typed = editOf(edits, l)?.amount;
                    const typedQty = editOf(edits, l)?.qty;
                    const typedRate = editOf(edits, l)?.rate;
                    const typedEach = editOf(edits, l)?.each;
                    // The line as it stands with any hand changes: a quantity typed over it prices it again.
                    const shown = editedLines([l], edits)[0] ?? l;
                    const unset = l.missing && typed === undefined && typedEach === undefined;
                    // A counted line's box is the cost of one; a line priced by the watt, or with no count, is its whole cost.
                    const counted = l.qty !== undefined && !l.watts;
                    const many = shown.qty ?? 0;
                    const eachNow = counted ? (typedEach ?? (many > 0 ? shown.amount / many : 0)) : shown.amount;
                    const boxValue = Math.round(eachNow * 100) / 100;
                    const boxTyped = counted ? typedEach !== undefined || typed !== undefined : typed !== undefined;
                    const on = Boolean(editOf(edits, l)?.on);
                    const out = Boolean(editOf(edits, l)?.removed);
                    const name = l.qty && /^\d+ × /.test(l.label) ? l.label.replace(/^\d+ × /, "") : l.label;
                    return (
                      <div
                        key={`${l.label}${i}`}
                        className={clsx(
                          "group px-3 py-1",
                          (unset || (l.confirm && !on && !out)) && "bg-sun shadow-[inset_3px_0_0_var(--sun-line)]",
                          l.confirm && out && "text-muted",
                        )}
                      >
                        <div className={cols}>
                          <div className="flex min-w-0 items-baseline gap-2 text-[13px]">
                            {l.watts ? (
                              // Priced by the watt (18 Nov 2026, Martin): the cents a watt is a box to type over.
                              <span className="inline-flex min-w-0 items-center gap-1">
                                <span className="truncate">{l.label.replace(/ at [\d.]+c a watt$/, " at")}</span>
                                <span className="inline-flex shrink-0 items-center rounded-md bg-surface px-1 ring-1 ring-line focus-within:ring-forest">
                                  <input
                                    type="number"
                                    min="0"
                                    step="0.5"
                                    value={
                                      Math.round((typedRate ?? (typed !== undefined ? typed / l.watts : l.amount / l.watts)) * 1000) / 10
                                    }
                                    onChange={(e) =>
                                      edit(l, {
                                        rate: Math.max(0, Math.min(MAX_RATE_PER_WATT, (Number(e.target.value) || 0) / 100)),
                                        amount: undefined,
                                      })
                                    }
                                    aria-label="Cents a watt for the solar installation"
                                    className="w-11 bg-transparent py-0 text-right font-semibold tabular-nums text-ink outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
                                  />
                                  <span className="pl-0.5 text-[11px] text-muted">c/W</span>
                                </span>
                              </span>
                            ) : (
                              <span className="truncate" title={name}>
                                {name}
                              </span>
                            )}
                            {l.sku && <span className="shrink-0 truncate text-[11px] text-muted">{l.sku}</span>}
                          </div>
                          <div className="text-right text-[13px] tabular-nums text-ink-2">
                            {l.qty !== undefined && (
                              <input
                                type="number"
                                min="0"
                                max={MAX_LINE_QTY}
                                step="1"
                                value={typedQty ?? l.qty}
                                onChange={(e) =>
                                  edit(l, { qty: Math.max(0, Math.min(MAX_LINE_QTY, Math.round(Number(e.target.value) || 0))) })
                                }
                                aria-label={`How many: ${l.label}`}
                                style={{ width: `${String(typedQty ?? l.qty).length + 1.6}ch` }}
                                className={`rounded-md border bg-transparent px-0.5 py-0 text-right tabular-nums outline-none [appearance:textfield] focus:border-forest [&::-webkit-inner-spin-button]:appearance-none ${
                                  typedQty !== undefined ? "border-sun-line font-semibold text-ink" : "border-transparent hover:border-line"
                                }`}
                              />
                            )}
                          </div>
                          <div className="text-right text-[13px]">
                            <span className="inline-flex items-center justify-end gap-px">
                              <span className="text-muted">$</span>
                              <input
                                type="number"
                                min="0"
                                step="1"
                                value={boxValue}
                                onChange={(e) => {
                                  const v = Math.max(0, Number(e.target.value) || 0);
                                  edit(l, counted ? { each: v, amount: undefined } : { amount: v });
                                }}
                                aria-label={counted ? `Cost each of ${l.label}` : `Cost of ${l.label}`}
                                style={{ width: `${String(boxValue).length + 1.6}ch` }}
                                className={`rounded-md border bg-transparent px-0.5 py-0 text-right tabular-nums outline-none [appearance:textfield] focus:border-forest [&::-webkit-inner-spin-button]:appearance-none ${
                                  boxTyped
                                    ? "border-sun-line font-semibold"
                                    : unset
                                      ? "border-warning"
                                      : "border-transparent hover:border-line"
                                }`}
                              />
                            </span>
                          </div>
                          <div className="text-right text-[13px] font-medium tabular-nums text-ink">{money(shown.amount)}</div>
                          <div className="text-right">
                            <button
                              hidden={Boolean(l.confirm)}
                              className="text-base leading-none text-muted opacity-0 hover:text-danger focus:opacity-100 group-hover:opacity-100"
                              onClick={() => edit(l, { removed: true })}
                              aria-label={`Take out ${l.label}`}
                              title="Take this line out"
                            >
                              ×
                            </button>
                          </div>
                        </div>
                        {l.confirm && (
                          <span className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs">
                            {on ? (
                              <>
                                <span className="font-medium text-positive">Included</span>
                                <button className="underline underline-offset-2 hover:text-ink" onClick={() => edit(l, { removed: true })}>
                                  leave it out
                                </button>
                              </>
                            ) : out ? (
                              <>
                                <span>Left out: the proposal says it may apply</span>
                                <button className="underline underline-offset-2 hover:text-ink" onClick={() => edit(l, { on: true })}>
                                  include it
                                </button>
                              </>
                            ) : (
                              <>
                                <span className="text-sun-ink">Decided on each job:</span>
                                <button
                                  className="rounded-full bg-primary px-2 py-0.5 font-semibold text-primary-ink"
                                  onClick={() => edit(l, { on: true })}
                                >
                                  Include
                                </button>
                                <button
                                  className="rounded-full px-2 py-0.5 font-semibold text-ink ring-1 ring-line hover:ring-ink-2"
                                  onClick={() => edit(l, { removed: true })}
                                >
                                  Leave out
                                </button>
                              </>
                            )}
                          </span>
                        )}
                        {unset && (
                          <span className="block text-xs text-sun-ink">
                            <strong className="font-semibold">No cost on file.</strong> Type one, or{" "}
                            <button className="font-semibold underline underline-offset-2" onClick={() => edit(l, { amount: 0 })}>
                              leave it at $0
                            </button>
                          </span>
                        )}
                        {(typed !== undefined || typedEach !== undefined || typedQty !== undefined || typedRate !== undefined) &&
                          (l.missing && typed === 0 && typedQty === undefined ? (
                            <button className="block text-xs text-muted underline underline-offset-2" onClick={() => edit(l, null)}>
                              Left at $0 (no cost on file): undo
                            </button>
                          ) : (
                            <button className="block text-xs text-sun-ink underline underline-offset-2" onClick={() => edit(l, null)}>
                              Changed by hand: back to {typedQty !== undefined ? `${l.qty} at ` : ""}
                              {typedRate !== undefined && l.watts ? `${centsWords(l.amount / l.watts)}c a watt, ` : ""}
                              {l.missing
                                ? "no cost"
                                : counted && l.qty
                                  ? `$${(Math.round((l.amount / l.qty) * 100) / 100).toLocaleString("en-AU")} each`
                                  : money(l.amount)}
                            </button>
                          ))}
                        {typedFlags[lineKey(l)] && (
                          <span className="flex items-start gap-1 text-xs text-warning">
                            <SolBadge className="mt-px size-3.5 shrink-0" />
                            {typedFlags[lineKey(l)]}
                          </span>
                        )}
                      </div>
                    );
                  })}
                  {decided.length > 0 && <DecidedLine lines={decided} edits={edits} />}
                </div>
              )}
            </section>
          );
        })}
        {/* Lines of the business's own (15 Nov 2026, Martin): a name, how many and the cost each, ex GST. */}
        {added.length > 0 && (
          <section className="overflow-hidden rounded-lg border border-line" aria-label="Added by you">
            <div className="flex items-center gap-2 bg-canvas px-3 py-1.5">
              <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-surface text-ink ring-1 ring-line">
                <Plus className="size-3.5" aria-hidden />
              </span>
              <span className="text-[13px] font-semibold text-ink">Added by you</span>
              <span className="text-[11px] text-muted">cost each</span>
              <span className="ml-auto text-[13px] font-semibold tabular-nums text-ink">
                {money(added.reduce((t, l) => t + l.amount, 0))}
              </span>
            </div>
            <div className="divide-y divide-line border-t border-line">
              {added.map((l) => {
                const e = edits[l.key];
                return (
                  <div key={l.key} className={clsx(cols, "group px-3 py-1 text-[13px]")}>
                    <div className="min-w-0">
                      <input
                        value={e.label ?? ""}
                        maxLength={MAX_ADDED_LABEL}
                        placeholder="What it is"
                        onChange={(ev) => setKey(l.key, { ...e, label: ev.target.value })}
                        onBlur={(ev) => !ev.target.value.trim() && setKey(l.key, { ...e, label: "New line" })}
                        aria-label="What the line is"
                        className="w-full rounded-md border border-transparent bg-transparent px-1 py-0 outline-none hover:border-line focus:border-forest"
                      />
                    </div>
                    <div className="text-right">
                      <input
                        type="number"
                        min="1"
                        max={MAX_LINE_QTY}
                        step="1"
                        value={e.qty ?? 1}
                        onChange={(ev) =>
                          setKey(l.key, { ...e, qty: Math.max(1, Math.min(MAX_LINE_QTY, Math.round(Number(ev.target.value) || 1))) })
                        }
                        aria-label={`How many: ${e.label}`}
                        style={{ width: `${String(e.qty ?? 1).length + 2}ch` }}
                        className={numberBox(false)}
                      />
                    </div>
                    <div className="text-right">
                      <span className="inline-flex items-center justify-end gap-px">
                        <span className="text-muted">$</span>
                        <input
                          type="number"
                          min="0"
                          step="1"
                          value={Math.round(e.amount ?? 0)}
                          onChange={(ev) => setKey(l.key, { ...e, amount: Math.max(0, Number(ev.target.value) || 0) })}
                          aria-label={`Cost each of ${e.label}`}
                          style={{ width: `${String(Math.round(e.amount ?? 0)).length + 2}ch` }}
                          className={numberBox(false)}
                        />
                      </span>
                    </div>
                    <div className="text-right font-medium tabular-nums text-ink">{money(l.amount)}</div>
                    <div className="text-right">
                      <button
                        className="text-base leading-none text-muted opacity-0 hover:text-danger focus:opacity-100 group-hover:opacity-100"
                        onClick={() => setKey(l.key, null)}
                        aria-label={`Take out ${e.label}`}
                        title="Take this line out"
                      >
                        ×
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}
      </div>
      {added.length < MAX_ADDED_LINES && (
        <button
          type="button"
          onClick={addLine}
          className="mt-3 rounded-full px-3 py-1 text-xs font-semibold text-ink ring-1 ring-line hover:ring-ink-2"
          title="A line of your own, at a cost ex GST: it is added to the price with the margin and GST"
        >
          + Add a line
        </button>
      )}
    </>
  );
  const changedBox = changed > 0 && (
    <p className="mt-3 rounded-md bg-sun p-2.5 text-xs text-sun-ink">
      {changed} {changed === 1 ? "line has" : "lines have"} been changed by hand
      {removed ? `, ${removed} taken out` : ""}. They stay as you set them while the design changes.{" "}
      <button className="font-semibold underline underline-offset-2" onClick={() => props.onChange({ form, edits: {} })}>
        Put them all back
      </button>
    </p>
  );
  const totalsBox = (
    <dl className="mt-4 space-y-1 rounded-md bg-canvas p-3 text-sm">
      <div className="flex justify-between">
        <dt className="text-muted">Your cost</dt>
        <dd className="tabular-nums">{money(totals.cost)}</dd>
      </div>
      {/* The margin can be typed over, in dollars or as a share of the price ex GST (15 Nov 2026, Martin). */}
      <div className="flex items-center justify-between gap-2">
        <dt className="text-muted">Margin</dt>
        <dd className="flex items-center gap-1 tabular-nums">
          <span className="text-muted">$</span>
          <input
            type="number"
            min="0"
            step="1"
            value={Math.round(totals.margin)}
            onChange={(e) => setMargin(Math.max(0, Number(e.target.value) || 0))}
            aria-label="Margin in dollars, ex GST"
            title="Type a margin in dollars, ex GST"
            style={{ width: `${String(Math.round(totals.margin)).length + 2}ch` }}
            className={numberBox(marginTyped)}
          />
          <input
            type="number"
            min="0"
            max="90"
            step="1"
            value={marginPct}
            onChange={(e) => setMarginPct(Number(e.target.value) || 0)}
            aria-label="Margin as a share of the price ex GST"
            title="Type a margin as a share of the price ex GST"
            style={{ width: `${String(marginPct).length + 2}ch` }}
            className={numberBox(marginTyped)}
          />
          <span className="text-muted">%</span>
        </dd>
      </div>
      {marginTyped && (
        <p className="text-right text-xs">
          <button className="text-sun-ink underline underline-offset-2" onClick={() => setMargin(null)}>
            Changed by hand: back to {money(costing.margin)}
          </button>
        </p>
      )}
      {[
        ["Price inc. GST", money(totals.priceIncGst)],
        [`After STCs (${money(stc)})`, money(totals.priceIncGst - stc)],
      ].map(([k, v]) => (
        <div key={k} className="flex justify-between font-semibold">
          <dt>{k}</dt>
          <dd className="tabular-nums">{v}</dd>
        </div>
      ))}
    </dl>
  );
  const priceCheckBox = advice.length > 0 && <PriceCheck advice={advice} typed={Object.keys(typedFlags).length} />;
  const solarVicBlock = solarVic && (
    <div className="mt-2 rounded-md border border-sun-line bg-sun p-3 text-sm">
      <dl className="space-y-1">
        <div className="flex justify-between">
          <dt className="text-sun-ink">Solar Victoria rebate, if approved</dt>
          <dd className="tabular-nums text-sun-ink">-{money(solarVic.rebate)}</dd>
        </div>
        <div className="flex justify-between font-semibold">
          <dt>After the rebate</dt>
          <dd className="tabular-nums">{money(solarVic.afterRebate)}</dd>
        </div>
        {solarVic.loan > 0 && (
          <>
            <div className="flex justify-between">
              <dt className="text-sun-ink">Interest-free loan, if approved</dt>
              <dd className="tabular-nums text-sun-ink">-{money(solarVic.loan)}</dd>
            </div>
            <div className="flex justify-between font-semibold">
              <dt>To pay up front</dt>
              <dd className="tabular-nums">{money(solarVic.upfront)}</dd>
            </div>
            <div className="flex justify-between text-ink-2">
              <dt>Then, for {solarVic.loanMonths} months</dt>
              <dd className="tabular-nums">${solarVic.monthly.toFixed(2)} a month</dd>
            </div>
          </>
        )}
      </dl>
      <p className="mt-2 text-xs leading-snug text-sun-ink">{solarVicNote(solarVic)}</p>
    </div>
  );
  const footBox = (
    <p className="mt-2 text-xs text-muted">
      {costing.panels} panels, {costing.pvKw} kW
      {costing.batteryKwh ? `, ${costing.batteryKwh} kWh battery` : ""}. Costs are ex GST: type over one to change it, or take a line out
      with its cross. An inverter or a battery is costed only when one is chosen on the design. STCs use the rules as at {rates.asOf}
      {form.postcode ? `, postcode ${form.postcode} (from the address)` : ""} and your price per certificate.
      {workspace.lists.length ? ` Prices from: ${workspace.lists.map((l) => l.name).join(", ")}.` : " No price list uploaded yet."}
    </p>
  );

  if (split)
    return (
      <section className="rounded-lg border border-line bg-surface p-3" aria-label="Quote builder" {...pickWhole}>
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
          <p className={clsx(label, "flex shrink-0 items-center gap-1 whitespace-nowrap")}>
            Quote builder ·
            {props.onDesign && (
              <button
                type="button"
                onClick={() => props.onDesign?.(-1)}
                aria-label="The design before"
                className="flex size-6 items-center justify-center rounded-full text-ink-2 hover:bg-surface-2 hover:text-ink"
              >
                <ChevronLeft className="size-4" aria-hidden />
              </button>
            )}
            <span>{props.design}</span>
            {props.onDesign && (
              <button
                type="button"
                onClick={() => props.onDesign?.(1)}
                aria-label="The next design"
                className="flex size-6 items-center justify-center rounded-full text-ink-2 hover:bg-surface-2 hover:text-ink"
              >
                <ChevronRight className="size-4" aria-hidden />
              </button>
            )}
          </p>
          <span className="flex items-center gap-3 whitespace-nowrap">
            {props.onCompact && (
              <button
                className="text-xs font-medium text-ink-2 underline underline-offset-4 hover:text-ink"
                onClick={() => props.onCompact?.(true)}
                title="A short view of the quote, so the picture has more room"
              >
                Short view
              </button>
            )}
            {!costing.lines.length ? null : (
              <PriceCart workspace={workspace} lines={costing.lines} onWorkspace={props.onWorkspace} open={cartOpen} onOpen={setCartOpen} />
            )}
            <Link href="/design/settings" className="text-xs font-medium text-ink-2 underline underline-offset-4 hover:text-ink">
              Prices and settings
            </Link>
          </span>
        </div>
        <div className="mt-3 grid items-start gap-5 md:grid-cols-[minmax(0,1fr)_21rem]">
          <div className="min-w-0 [&>table:first-child]:mt-0">
            {tableBlock}
            {footBox}
          </div>
          <aside className="space-y-2.5 md:sticky md:top-0 [&>*]:mt-0" aria-label="To switch and decide">
            {homeBox}
            {solarVicBox}
            {confirms.length > 0 && (
              <div className="rounded-md border border-line bg-canvas p-2.5" role="group" aria-label="Decided on each job">
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-2">Decided on each job</p>
                <p className="mt-0.5 text-[11px] leading-snug text-muted">
                  Include it in the price, or leave it out and the proposal says it may apply. Nothing is published until each is decided.
                </p>
                <ul className="mt-2 space-y-1">
                  {confirms.map((l) => {
                    const on = Boolean(editOf(edits, l)?.on);
                    const out = Boolean(editOf(edits, l)?.removed);
                    return (
                      <li
                        key={lineKey(l)}
                        className={
                          on || out
                            ? "flex items-center gap-2 rounded-md px-1.5 py-1"
                            : "flex items-center gap-2 rounded-md bg-sun px-1.5 py-1 shadow-[inset_3px_0_0_var(--sun-line)]"
                        }
                      >
                        <span className="min-w-0 flex-1 text-xs text-ink">{l.label}</span>
                        <span
                          role="radiogroup"
                          aria-label={l.label}
                          className="flex shrink-0 rounded-md border border-line bg-surface p-0.5 text-[11px] font-medium"
                        >
                          <button
                            type="button"
                            role="radio"
                            aria-checked={on}
                            onClick={() => edit(l, { on: true })}
                            className={
                              on ? "rounded-[5px] bg-ink px-2 py-0.5 text-canvas" : "rounded-[5px] px-2 py-0.5 text-ink-2 hover:text-ink"
                            }
                          >
                            Include
                          </button>
                          <button
                            type="button"
                            role="radio"
                            aria-checked={out}
                            onClick={() => edit(l, { removed: true })}
                            className={
                              out ? "rounded-[5px] bg-ink px-2 py-0.5 text-canvas" : "rounded-[5px] px-2 py-0.5 text-ink-2 hover:text-ink"
                            }
                          >
                            Leave out
                          </button>
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
            {missing > 0 && (
              <p className="mb-3 rounded-md bg-warning-soft p-2.5 text-xs text-warning" role="status">
                {missing} {missing === 1 ? "line has" : "lines have"} no cost on file, so {missing === 1 ? "it counts" : "they count"} as
                $0. Each is highlighted below: type a cost over it, leave it at $0, or{" "}
                <button type="button" className="font-semibold underline underline-offset-2" onClick={() => setCartOpen(true)}>
                  upload a price list or set a price in the cart
                </button>
                .
              </p>
            )}
            {totalsBox}
            {priceCheckBox}
            {proceedBox}
            {solarVicBlock}
            {changedBox}
          </aside>
        </div>
      </section>
    );

  return (
    <section className="rounded-lg border border-line bg-surface p-3" aria-label="Quote builder" {...pickWhole}>
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <p className={clsx(label, "flex shrink-0 items-center gap-1 whitespace-nowrap")}>
          Quote builder ·
          {props.onDesign && (
            <button
              type="button"
              onClick={() => props.onDesign?.(-1)}
              aria-label="The design before"
              className="flex size-6 items-center justify-center rounded-full text-ink-2 hover:bg-surface-2 hover:text-ink"
            >
              <ChevronLeft className="size-4" aria-hidden />
            </button>
          )}
          <span>{props.design}</span>
          {props.onDesign && (
            <button
              type="button"
              onClick={() => props.onDesign?.(1)}
              aria-label="The next design"
              className="flex size-6 items-center justify-center rounded-full text-ink-2 hover:bg-surface-2 hover:text-ink"
            >
              <ChevronRight className="size-4" aria-hidden />
            </button>
          )}
        </p>
        <span className="flex items-center gap-3 whitespace-nowrap">
          {props.onCompact && (
            <button
              className="text-xs font-medium text-ink-2 underline underline-offset-4 hover:text-ink"
              onClick={() => props.onCompact?.(true)}
              title="A short view of the quote, so the picture has more room"
            >
              Short view
            </button>
          )}
          {!costing.lines.length ? null : (
            <PriceCart workspace={workspace} lines={costing.lines} onWorkspace={props.onWorkspace} open={cartOpen} onOpen={setCartOpen} />
          )}
          <Link href="/design/settings" className="text-xs font-medium text-ink-2 underline underline-offset-4 hover:text-ink">
            Prices and settings
          </Link>
        </span>
      </div>
      {!props.homeless && <div className="mt-2.5">{homeBox}</div>}
      {solarVicBox}
      {empty ? (
        <p className="mt-4 text-sm text-ink-2">Put panels on the roof and they appear here, costed as you go.</p>
      ) : (
        <div className="mt-4">
          {missing > 0 && (
            <p className="mb-3 rounded-md bg-warning-soft p-2.5 text-xs text-warning" role="status">
              {missing} {missing === 1 ? "line has" : "lines have"} no cost on file, so {missing === 1 ? "it counts" : "they count"} as $0.
              Each is highlighted below: type a cost over it, leave it at $0, or{" "}
              <button type="button" className="font-semibold underline underline-offset-2" onClick={() => setCartOpen(true)}>
                upload a price list or set a price in the cart
              </button>
              .
            </p>
          )}
          {undecided.length > 0 && (
            <p className="mb-3 rounded-md bg-sun p-2.5 text-xs text-sun-ink" role="status">
              <strong className="font-semibold">Decide on {undecided.map((l) => l.label.toLowerCase()).join(", ")}.</strong> Each sometimes
              applies: include it in the price, or leave it out and the proposal says it may apply, found at the site inspection. Nothing is
              published until each is decided.
            </p>
          )}
          {tableBlock}
          {changedBox}
          {totalsBox}
          {priceCheckBox}
          {solarVicBlock}
          {footBox}
          {proceedBox}
        </div>
      )}
    </section>
  );
}

/**
 * The three things about the home that change the price (roof, storeys, phase), each a choice between its options:
 * one tap each. Easy to pass over, so the pad asks to be checked, and settles once one has been set on this visit.
 */
export function HomeToggles(props: {
  form: QuoteFields["form"];
  onPick: (name: "roof" | "storeys" | "phase", value: string) => void;
  /** Already answered (Sol's guide asked roof, storeys and phase first): nothing to check again (15 Nov 2026, Martin). */
  settled?: boolean;
}) {
  const [picked, setChecked] = useState(false);
  const checked = picked || Boolean(props.settled);
  const pick = (name: "roof" | "storeys" | "phase", value: string) => {
    setChecked(true);
    props.onPick(name, value);
  };
  return (
    <div className={checked ? "rounded-md border border-line bg-canvas p-2" : "rounded-md border border-sun-line bg-sun p-2"}>
      <p
        className={
          checked
            ? "text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-2"
            : "text-[10px] font-semibold uppercase tracking-[0.14em] text-sun-ink"
        }
      >
        {checked ? "This home" : "This home · check these, they change the price"}
      </p>
      <div className="mt-1.5 grid grid-cols-[3.5rem_1fr] items-center gap-x-2 gap-y-1 text-[11px] font-medium text-ink-2">
        {(
          [
            [
              "roof",
              "Roof",
              props.form.roof,
              [
                ["tile", "Tile"],
                ["tin", "Tin"],
                ["flat", "Flat"],
              ],
            ],
            [
              "storeys",
              "Storeys",
              props.form.storeys,
              [
                ["single", "Single"],
                ["double", "Double"],
              ],
            ],
            [
              "phase",
              "Phase",
              props.form.phase,
              [
                ["single", "Single"],
                ["three", "Three"],
              ],
            ],
          ] as const
        ).map(([name, title, value, choices]) => (
          <div key={name} className="contents">
            <span>{title}</span>
            <div role="radiogroup" aria-label={title} className="flex rounded-md border border-line bg-surface p-0.5">
              {choices.map(([v, text]) => (
                <button
                  key={v}
                  type="button"
                  role="radio"
                  aria-checked={value === v}
                  onClick={() => pick(name, v)}
                  className={
                    value === v
                      ? "flex-1 rounded-[5px] bg-ink px-2 py-0.5 text-canvas"
                      : "flex-1 rounded-[5px] px-2 py-0.5 text-ink-2 hover:text-ink"
                  }
                >
                  {text}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Sol's price check under the totals (18 Nov 2026, Martin): what the quote's price and margin are against the business's
 * own signed and quiet proposals, worked out by rule (no credit). Asking Sol about it opens his panel with the figures.
 */
export function PriceCheck({ advice, typed }: { advice: Advice[]; typed: number }) {
  const ask = () => {
    const lines = advice.map((a) => `- ${a.text}`).join("\n");
    askSolInPanel({
      text:
        "Look at the price on the quote I have open. Your price check says:\n" +
        lines +
        (typed ? `\n- ${typed} cost${typed === 1 ? "" : "s"} typed by hand differ from the price list or what we costed before.` : "") +
        "\nWhat would you do with this price, and why? Advise only: I set the price.",
      shown: "Sol, what would you do with this price?",
    });
  };
  return (
    <section className="mt-3 rounded-md border border-line bg-surface p-3" aria-label="Sol's price check">
      <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-2">
        <SolBadge className="size-4" /> Price check
      </p>
      <ul className="mt-2 space-y-1.5 text-xs leading-snug">
        {advice.map((a) => (
          <li key={a.text} className="flex gap-2">
            <span
              aria-hidden
              className={clsx(
                "mt-1.5 size-1.5 shrink-0 rounded-full",
                a.tone === "warn" ? "bg-warning" : a.tone === "ok" ? "bg-positive" : "bg-line",
              )}
            />
            <span className={a.tone === "warn" ? "text-ink" : "text-ink-2"}>{a.text}</span>
          </li>
        ))}
      </ul>
      <div className="mt-2.5 flex items-center justify-between gap-2">
        <p className="text-[10px] leading-snug text-muted">From your own proposals, by rule. A guide: you set the price.</p>
        <button
          type="button"
          onClick={ask}
          className="shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold text-ink ring-1 ring-line hover:ring-ink-2"
        >
          Ask Sol
        </button>
      </div>
    </section>
  );
}

/**
 * Asked by Proceed to proposal when the Solar Victoria switches were never touched and the rebate can apply, in case
 * they were overlooked (19 Nov 2026, Martin). Each answer goes on to the proposal; the cross or Escape stays here.
 */
function SolarVicAsk(props: { rebate: number; onChoose: (rebate: boolean, loan: boolean) => void; onClose: () => void }) {
  const { onClose } = props;
  useEffect(() => {
    const key = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [onClose]);
  const choice = "w-full rounded-full px-4 py-2.5 text-sm font-semibold";
  // Drawn on the page body (19 Nov 2026, Martin: it opened half drawn over the quote): the quote sits in a panel whose own
  // frame pinned a "fixed" box to it, so the dimming stopped part way and the question sat over the column headings.
  if (typeof document === "undefined") return null;
  return createPortal(
    <div className="theme-studio contents">
      <div
        className="fixed inset-0 z-[80] flex items-center justify-center bg-ink/40 p-4"
        onMouseDown={(e) => e.target === e.currentTarget && onClose()}
      >
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="solar-vic-ask"
          className="w-full max-w-sm rounded-2xl bg-surface p-5 text-left shadow-[0_24px_60px_rgba(0,0,0,0.25)]"
        >
          <h2 id="solar-vic-ask" className="text-base font-semibold text-ink">
            Offer the Solar Victoria rebate?
          </h2>
          <p className="mt-1.5 text-sm leading-snug text-ink-2">
            The rebate and loan are both off on this quote. If the customer is eligible, the rebate takes about {money(props.rebate)} off,
            subject to Solar Victoria&rsquo;s approval.
          </p>
          <div className="mt-4 space-y-2">
            <button type="button" autoFocus onClick={() => props.onChoose(true, false)} className={clsx(choice, "bg-ink text-white")}>
              Add the rebate
            </button>
            <button
              type="button"
              onClick={() => props.onChoose(true, true)}
              className={clsx(choice, "text-ink ring-1 ring-line hover:ring-ink-2")}
            >
              Add the rebate and the loan
            </button>
            <button type="button" onClick={() => props.onChoose(false, false)} className={clsx(choice, "text-ink-2 hover:text-ink")}>
              Go ahead without them
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
