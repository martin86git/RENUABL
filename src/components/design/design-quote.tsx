"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { Workspace } from "@/lib/domain/design/pricing";
import {
  COST_GROUPS,
  costSystem,
  editedLines,
  lineKey,
  MAX_LINE_QTY,
  repriced,
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
  /** Which of the roof's designs this is: "Design 2". */
  design: string;
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
  onCompact?: (compact: boolean) => void;
  /** The home's roof, storeys and phase are shown elsewhere (the design tool's Designer view), so not here. */
  homeless?: boolean;
}) {
  const { form, edits } = props.value;
  const { spec, workspace, rates } = props;
  const empty = spec.panels === 0;
  const costing = costSystem(spec, form, workspace);
  const stc = stcValue(costing, /^\d{4}$/.test(form.postcode) ? form.postcode : null, todayInMarket(), rates, workspace.settings.stcPrice);

  const all = costing.lines;
  const lines = editedLines(all, edits);
  const changed = all.filter((l) => edits[lineKey(l)]).length;
  const removed = all.filter((l) => edits[lineKey(l)]?.removed).length;
  const totals = changed ? repriced(costing, lines) : costing;
  const missing = lines.filter((l) => l.missing).length;
  const net = empty ? null : totals.priceIncGst - stc;
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
    else next[key] = { ...next[key], ...to };
    props.onChange({ form, edits: next });
  };

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
                ["Margin", money(costing.margin)],
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

  return (
    <section className="rounded-lg border border-line bg-surface p-3" aria-label="Quote builder">
      <div className="flex items-baseline justify-between gap-2">
        <p className={label}>Quote builder · {props.design}</p>
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
      {/* The three things about the home that change the price; in the design tool they sit in its Designer view. */}
      {!props.homeless && (
        <div className="mt-2.5">
          <HomeToggles
            form={form}
            onPick={(name, value) => props.onChange({ form: { ...form, [name]: value } as QuoteFields["form"], edits })}
          />
        </div>
      )}

      {/* Solar Victoria: switched on, the rebate (and loan) go on the quote and on its proposal, always as "if approved". */}
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
        {form.solarVicRebate && solarVicOff && (
          <p className="mt-1 text-[11px] text-sun-ink">{solarVicOff} Nothing is added to this quote.</p>
        )}
      </div>

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
          {COST_GROUPS.map((group) => {
            const rows = all.filter((l) => l.group === group && !edits[lineKey(l)]?.removed);
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
                    // The line as it stands with any hand changes: a quantity typed over it prices it again.
                    const shown = editedLines([l], edits)[0] ?? l;
                    const unset = l.missing && typed === undefined;
                    return (
                      <tr
                        key={`${l.label}${i}`}
                        className={
                          unset
                            ? // A line with no cost asks to be dealt with: priced, or knowingly left at nothing.
                              "group border-b border-line bg-sun align-top shadow-[inset_3px_0_0_var(--sun-line)] last:border-0"
                            : "group border-b border-line align-top last:border-0"
                        }
                      >
                        <td className={unset ? "py-1.5 pl-2.5 pr-2" : "py-1.5 pr-2"}>
                          {l.qty && /^\d+ × /.test(l.label) ? l.label.replace(/^\d+ × /, "") : l.label}
                          {l.sku && <span className="block text-xs text-muted">{l.sku}</span>}
                          {unset && (
                            <span className="mt-0.5 block text-xs text-sun-ink">
                              <strong className="font-semibold">No cost on file.</strong> Type one, or{" "}
                              <button className="font-semibold underline underline-offset-2" onClick={() => edit(l, { amount: 0 })}>
                                leave it at $0
                              </button>
                            </span>
                          )}
                          {(typed !== undefined || typedQty !== undefined) &&
                            (l.missing && typed === 0 && typedQty === undefined ? (
                              <button className="block text-xs text-muted underline underline-offset-2" onClick={() => edit(l, null)}>
                                Left at $0 (no cost on file): undo
                              </button>
                            ) : (
                              <button className="block text-xs text-sun-ink underline underline-offset-2" onClick={() => edit(l, null)}>
                                Changed by hand: back to {typedQty !== undefined ? `${l.qty} at ` : ""}
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
                              onChange={(e) =>
                                edit(l, { qty: Math.max(0, Math.min(MAX_LINE_QTY, Math.round(Number(e.target.value) || 0))) })
                              }
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
          {changed > 0 && (
            <p className="mt-3 rounded-md bg-sun p-2.5 text-xs text-sun-ink">
              {changed} {changed === 1 ? "line has" : "lines have"} been changed by hand
              {removed ? `, ${removed} taken out` : ""}. They stay as you set them while the design changes.{" "}
              <button className="font-semibold underline underline-offset-2" onClick={() => props.onChange({ form, edits: {} })}>
                Put them all back
              </button>
            </p>
          )}
          <dl className="mt-4 space-y-1 rounded-md bg-canvas p-3 text-sm">
            {[
              ["Your cost", money(totals.cost)],
              [
                "Margin",
                `${money(costing.margin)} (${totals.priceExGst > 0 ? Math.round((costing.margin / totals.priceExGst) * 100) : 0}%)`,
              ],
              ["Price inc. GST", money(totals.priceIncGst)],
              [`After STCs (${money(stc)})`, money(totals.priceIncGst - stc)],
            ].map(([k, v], i) => (
              <div key={k} className={i >= 2 ? "flex justify-between font-semibold" : "flex justify-between"}>
                <dt className={i >= 2 ? "" : "text-muted"}>{k}</dt>
                <dd className="tabular-nums">{v}</dd>
              </div>
            ))}
          </dl>
          {solarVic && (
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
          )}
          <p className="mt-2 text-xs text-muted">
            {costing.panels} panels, {costing.pvKw} kW
            {costing.batteryKwh ? `, ${costing.batteryKwh} kWh battery` : ""}. Costs are ex GST: type over one to change it, or take a line
            out with its cross. An inverter or a battery is costed only when one is chosen on the design. STCs use the rules as at{" "}
            {rates.asOf}
            {form.postcode ? `, postcode ${form.postcode} (from the address)` : ""} and your price per certificate.
            {workspace.lists.length ? ` Prices from: ${workspace.lists.map((l) => l.name).join(", ")}.` : " No price list uploaded yet."}
          </p>
        </div>
      )}
    </section>
  );
}

/**
 * The three things about the home that change the price (roof, storeys, phase), each a choice between its options:
 * one tap each. Easy to pass over, so the pad asks to be checked, and settles once one has been set on this visit.
 */
export function HomeToggles(props: { form: QuoteFields["form"]; onPick: (name: "roof" | "storeys" | "phase", value: string) => void }) {
  const [checked, setChecked] = useState(false);
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
