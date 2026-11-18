"use client";

import clsx from "clsx";
import { ArrowRight, ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import type { Workspace } from "@/lib/domain/design/pricing";
import {
  COST_GROUPS,
  costSystem,
  editedLines,
  undecidedLines,
  lineKey,
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
}) {
  const { form, edits } = props.value;
  const { spec, workspace, rates } = props;
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
  const changed = all.filter((l) => edits[lineKey(l)] && !l.confirm).length;
  const removed = all.filter((l) => edits[lineKey(l)]?.removed && !l.confirm).length;
  // Costs that sometimes apply, not yet included or left out: nothing is published until each is decided.
  const undecided = undecidedLines(all, edits);
  const missing = lines.filter((l) => l.missing).length;
  const net = empty ? null : totals.priceIncGst - stc;
  const proceedBox = props.onProceed && !empty && (
    <div className="mt-3 border-t border-line pt-3">
      <button
        type="button"
        onClick={props.onProceed}
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
      <p className="mt-1.5 text-center text-[11px] text-muted">
        {undecided.length > 0
          ? `Decide on ${undecided.length === 1 ? "the cost" : `the ${undecided.length} costs`} above first.`
          : "Saves the design, then opens the proposal to check and send."}
      </p>
    </div>
  );
  // Solar Victoria, when it has been put on this quote: always "if approved".
  const solarVic = empty ? null : solarVicFor(form, costing.panels, totals.priceIncGst, stc, rates);
  const solarVicOff = solarVicBar(form, costing.panels, rates);
  const setSolarVic = (rebate: boolean, loan: boolean) =>
    // The loan goes with the rebate: switching the loan on switches the rebate on, and switching the rebate off takes the loan too.
    props.onChange({ form: { ...form, solarVicRebate: rebate || loan, solarVicLoan: loan && (rebate || loan) }, edits });
  const { onNet } = props;
  useEffect(() => onNet(net), [onNet, net]);

  /** Changes a line by hand: a quantity and a cost typed over it sit together; null puts the line back as worked out. */
  const edit = (l: CostLine, to: LineEdit | null) => {
    const next = { ...edits };
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
      <section className="rounded-lg border border-line bg-surface p-2.5 text-[11px]" aria-label="Quote builder, short view">
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
  const tableBlock = (
    <>
      {COST_GROUPS.map((group) => {
        // A cost decided on each job stays in the list when left out, so it can be included again.
        const rows = all.filter((l) => l.group === group && (l.confirm || !edits[lineKey(l)]?.removed));
        if (!rows.length) return null;
        return (
          <table key={group} className="mt-4 w-full table-fixed text-sm first:mt-0">
            <thead>
              <tr className="border-b-2 border-forest text-xs font-semibold uppercase tracking-[0.12em] text-forest">
                <th className="pb-1 text-left">{group}</th>
                <th className="w-10 pb-1 text-right">Qty</th>
                <th className="w-[5.5rem] pb-1 text-right">Cost</th>
                <th className="w-6 pb-1" aria-label="Take out" />
              </tr>
            </thead>
            <tbody>
              {rows.map((l, i) => {
                const typed = edits[lineKey(l)]?.amount;
                const typedQty = edits[lineKey(l)]?.qty;
                const typedRate = edits[lineKey(l)]?.rate;
                // The line as it stands with any hand changes: a quantity typed over it prices it again.
                const shown = editedLines([l], edits)[0] ?? l;
                const unset = l.missing && typed === undefined;
                const on = Boolean(edits[lineKey(l)]?.on);
                const out = Boolean(edits[lineKey(l)]?.removed);
                return (
                  <tr
                    key={`${l.label}${i}`}
                    className={
                      l.confirm && !on && !out
                        ? "group border-b border-line bg-sun align-top shadow-[inset_3px_0_0_var(--sun-line)] last:border-0"
                        : l.confirm && out
                          ? "group border-b border-line align-top text-muted last:border-0"
                          : unset
                            ? // A line with no cost asks to be dealt with: priced, or knowingly left at nothing.
                              "group border-b border-line bg-sun align-top shadow-[inset_3px_0_0_var(--sun-line)] last:border-0"
                            : "group border-b border-line align-top last:border-0"
                    }
                  >
                    <td className={unset || (l.confirm && !on && !out) ? "py-1.5 pl-2.5 pr-2" : "py-1.5 pr-2"}>
                      {l.watts ? (
                        // Priced by the watt (18 Nov 2026, Martin): the cents a watt is a box to type over, always shown as one.
                        <span className="inline-flex flex-wrap items-center gap-1">
                          {l.label.replace(/ at [\d.]+c a watt$/, " at")}
                          <span className="inline-flex items-center rounded-md bg-surface px-1 ring-1 ring-line focus-within:ring-forest">
                            <input
                              type="number"
                              min="0"
                              step="0.5"
                              value={Math.round((typedRate ?? (typed !== undefined ? typed / l.watts : l.amount / l.watts)) * 1000) / 10}
                              onChange={(e) =>
                                edit(l, {
                                  rate: Math.max(0, Math.min(MAX_RATE_PER_WATT, (Number(e.target.value) || 0) / 100)),
                                  amount: undefined,
                                })
                              }
                              aria-label="Cents a watt for the solar installation"
                              className="w-12 bg-transparent py-0.5 text-right font-semibold tabular-nums text-ink outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
                            />
                            <span className="pl-0.5 text-xs text-muted">c/W</span>
                          </span>
                        </span>
                      ) : l.qty && /^\d+ × /.test(l.label) ? (
                        l.label.replace(/^\d+ × /, "")
                      ) : (
                        l.label
                      )}
                      {l.confirm && split && (
                        <span
                          className={
                            on ? "mt-0.5 block text-xs text-positive" : out ? "mt-0.5 block text-xs" : "mt-0.5 block text-xs text-sun-ink"
                          }
                        >
                          {on ? "Included" : out ? "Left out: the proposal says it may apply" : "To decide, beside the quote"}
                        </span>
                      )}
                      {l.confirm && !split && (
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
                      {l.sku && <span className="block text-xs text-muted">{l.sku}</span>}
                      {unset && (
                        <span className="mt-0.5 block text-xs text-sun-ink">
                          <strong className="font-semibold">No cost on file.</strong> Type one, or{" "}
                          <button className="font-semibold underline underline-offset-2" onClick={() => edit(l, { amount: 0 })}>
                            leave it at $0
                          </button>
                        </span>
                      )}
                      {(typed !== undefined || typedQty !== undefined || typedRate !== undefined) &&
                        (l.missing && typed === 0 && typedQty === undefined ? (
                          <button className="block text-xs text-muted underline underline-offset-2" onClick={() => edit(l, null)}>
                            Left at $0 (no cost on file): undo
                          </button>
                        ) : (
                          <button className="block text-xs text-sun-ink underline underline-offset-2" onClick={() => edit(l, null)}>
                            Changed by hand: back to {typedQty !== undefined ? `${l.qty} at ` : ""}
                            {typedRate !== undefined && l.watts ? `${centsWords(l.amount / l.watts)}c a watt, ` : ""}
                            {l.missing ? "no cost" : money(l.amount)}
                          </button>
                        ))}
                    </td>
                    <td className="py-1 text-right tabular-nums text-ink-2">
                      {l.qty === undefined ? (
                        ""
                      ) : (
                        <input
                          type="number"
                          min="0"
                          max={MAX_LINE_QTY}
                          step="1"
                          value={typedQty ?? l.qty}
                          onChange={(e) => edit(l, { qty: Math.max(0, Math.min(MAX_LINE_QTY, Math.round(Number(e.target.value) || 0))) })}
                          aria-label={`How many: ${l.label}`}
                          style={{ width: `${String(typedQty ?? l.qty).length + 1.6}ch` }}
                          className={`rounded-md border bg-transparent px-0.5 py-0.5 text-right tabular-nums outline-none [appearance:textfield] focus:border-forest [&::-webkit-inner-spin-button]:appearance-none ${
                            typedQty !== undefined ? "border-sun-line font-semibold text-ink" : "border-transparent hover:border-line"
                          }`}
                        />
                      )}
                    </td>
                    <td className="py-1 pl-1 text-right">
                      <span className="inline-flex items-center justify-end gap-px">
                        <span className="text-muted">$</span>
                        <input
                          type="number"
                          min="0"
                          step="1"
                          value={Math.round(typed ?? shown.amount)}
                          onChange={(e) => edit(l, { amount: Math.max(0, Number(e.target.value) || 0) })}
                          aria-label={`Cost of ${l.label}`}
                          style={{ width: `${String(Math.round(typed ?? shown.amount)).length + 1.6}ch` }}
                          className={`rounded-md border bg-transparent px-0.5 py-0.5 text-right tabular-nums outline-none [appearance:textfield] focus:border-forest [&::-webkit-inner-spin-button]:appearance-none ${
                            typed !== undefined
                              ? "border-sun-line font-semibold"
                              : unset
                                ? "border-warning"
                                : "border-transparent hover:border-line"
                          }`}
                        />
                      </span>
                    </td>
                    <td className="py-1.5 text-right">
                      <button
                        hidden={Boolean(l.confirm)}
                        className="text-base leading-none text-muted hover:text-danger"
                        onClick={() => edit(l, { removed: true })}
                        aria-label={`Take out ${l.label}`}
                        title="Take this line out"
                      >
                        ×
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        );
      })}
      {/* Lines of the business's own (15 Nov 2026, Martin): a name, how many and the cost each, ex GST. */}
      {added.length > 0 && (
        <table className="mt-4 w-full table-fixed text-sm">
          <thead>
            <tr className="border-b-2 border-forest text-xs font-semibold uppercase tracking-[0.12em] text-forest">
              <th className="pb-1 text-left">Added by you</th>
              <th className="w-10 pb-1 text-right">Qty</th>
              <th className="w-[5.5rem] pb-1 text-right">Each</th>
              <th className="w-6 pb-1" aria-label="Take out" />
            </tr>
          </thead>
          <tbody>
            {added.map((l) => {
              const e = edits[l.key];
              return (
                <tr key={l.key} className="border-b border-line align-top last:border-0">
                  <td className="py-1 pr-2">
                    <input
                      value={e.label ?? ""}
                      maxLength={MAX_ADDED_LABEL}
                      placeholder="What it is"
                      onChange={(ev) => setKey(l.key, { ...e, label: ev.target.value })}
                      onBlur={(ev) => !ev.target.value.trim() && setKey(l.key, { ...e, label: "New line" })}
                      aria-label="What the line is"
                      className="w-full rounded-md border border-transparent bg-transparent px-1 py-0.5 outline-none hover:border-line focus:border-forest"
                    />
                    {(e.qty ?? 1) > 1 && <span className="block px-1 text-xs text-muted">{money(l.amount)} in all</span>}
                  </td>
                  <td className="py-1 text-right">
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
                  </td>
                  <td className="py-1 pl-1 text-right">
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
                  </td>
                  <td className="py-1.5 text-right">
                    <button
                      className="text-base leading-none text-muted hover:text-danger"
                      onClick={() => setKey(l.key, null)}
                      aria-label={`Take out ${e.label}`}
                      title="Take this line out"
                    >
                      ×
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
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
      <section className="rounded-lg border border-line bg-surface p-3" aria-label="Quote builder">
        <div className="flex items-baseline justify-between gap-2">
          <p className={clsx(label, "flex items-center gap-1")}>
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
          <span className="flex items-baseline gap-3">
            {props.onCompact && (
              <button
                className="text-xs font-medium text-ink-2 underline underline-offset-4 hover:text-ink"
                onClick={() => props.onCompact?.(true)}
                title="A short view of the quote, so the picture has more room"
              >
                Short view
              </button>
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
                    const on = Boolean(edits[lineKey(l)]?.on);
                    const out = Boolean(edits[lineKey(l)]?.removed);
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
                <Link href="/design/settings" className="font-semibold underline underline-offset-2">
                  upload a price list or set the part&apos;s cost
                </Link>
                .
              </p>
            )}
            {totalsBox}
            {proceedBox}
            {solarVicBlock}
            {changedBox}
          </aside>
        </div>
      </section>
    );

  return (
    <section className="rounded-lg border border-line bg-surface p-3" aria-label="Quote builder">
      <div className="flex items-baseline justify-between gap-2">
        <p className={clsx(label, "flex items-center gap-1")}>
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
        <span className="flex items-baseline gap-3">
          {props.onCompact && (
            <button
              className="text-xs font-medium text-ink-2 underline underline-offset-4 hover:text-ink"
              onClick={() => props.onCompact?.(true)}
              title="A short view of the quote, so the picture has more room"
            >
              Short view
            </button>
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
              <Link href="/design/settings" className="font-semibold underline underline-offset-2">
                upload a price list or set the part&apos;s cost
              </Link>
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
