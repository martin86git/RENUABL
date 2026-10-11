"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { Workspace } from "@/lib/domain/design/pricing";
import {
  COST_GROUPS,
  costSystem,
  editedLines,
  lineKey,
  repriced,
  stcValue,
  type CostLine,
  type QuoteFields,
  type SystemSpec,
} from "@/lib/domain/design/quote";
import { todayInMarket } from "@/lib/domain/market";
import type { RebateRates } from "@/lib/domain/rebates";

const money = (n: number) => (n < 0 ? "-$" : "$") + Math.abs(Math.round(n)).toLocaleString("en-AU");
const field = "mt-1 block min-h-10 w-full rounded-md border border-line bg-surface px-2.5 text-sm outline-none focus:border-forest";
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
  const { onNet } = props;
  useEffect(() => onNet(net), [onNet, net]);

  // The four things about the home that change the price are easy to pass over: they sit in a pad that asks to be
  // checked, and it settles once one of them has been set on this visit.
  const [checked, setChecked] = useState(false);
  const set = (name: keyof typeof form) => (e: { target: { value: string } }) => {
    setChecked(true);
    props.onChange({ form: { ...form, [name]: e.target.value } as QuoteFields["form"], edits });
  };
  const edit = (l: CostLine, to: { amount?: number; removed?: boolean } | null) => {
    const next = { ...edits };
    if (to) next[lineKey(l)] = to;
    else delete next[lineKey(l)];
    props.onChange({ form, edits: next });
  };

  return (
    <section className="rounded-lg border border-line bg-surface p-4" aria-label="Quote builder">
      <div className="flex items-baseline justify-between gap-2">
        <p className={label}>Quote builder · {props.design}</p>
        <Link href="/design/settings" className="text-xs font-medium text-ink-2 underline underline-offset-4 hover:text-ink">
          Prices and settings
        </Link>
      </div>
      <div className={checked ? "mt-3 rounded-md border border-line bg-canvas p-3" : "mt-3 rounded-md border border-sun-line bg-sun p-3"}>
        <p className="flex items-center justify-between gap-2 text-[10px] font-semibold uppercase tracking-[0.14em]">
          <span className={checked ? "text-ink-2" : "text-sun-ink"}>This home</span>
          <span className={checked ? "text-muted" : "text-sun-ink"}>
            {checked ? "Set on this visit" : "Check these: they change the price"}
          </span>
        </p>
        <div className="mt-2 grid grid-cols-2 gap-2 text-xs font-medium">
          <label>
            Roof
            <select value={form.roof} onChange={set("roof")} className={`${field} appearance-auto`}>
              <option value="tile">Tile</option>
              <option value="tin">Tin</option>
              <option value="flat">Flat (Kliplok)</option>
            </select>
          </label>
          <label>
            Storeys
            <select value={form.storeys} onChange={set("storeys")} className={`${field} appearance-auto`}>
              <option value="single">Single</option>
              <option value="double">Double</option>
            </select>
          </label>
          <label>
            Phase
            <select value={form.phase} onChange={set("phase")} className={`${field} appearance-auto`}>
              <option value="single">Single phase</option>
              <option value="three">Three phase</option>
            </select>
          </label>
          <label>
            Postcode (rebate zone)
            <input inputMode="numeric" maxLength={4} value={form.postcode} onChange={set("postcode")} className={field} />
          </label>
        </div>
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
                          {typed !== undefined &&
                            (l.missing && typed === 0 ? (
                              <button className="block text-xs text-muted underline underline-offset-2" onClick={() => edit(l, null)}>
                                Left at $0 (no cost on file): undo
                              </button>
                            ) : (
                              <button className="block text-xs text-sun-ink underline underline-offset-2" onClick={() => edit(l, null)}>
                                Changed by hand: back to {l.missing ? "no cost" : money(l.amount)}
                              </button>
                            ))}
                        </td>
                        <td className="py-1.5 text-right tabular-nums text-ink-2">{l.qty ?? ""}</td>
                        <td className="py-1 pl-1 text-right">
                          <span className="inline-flex items-center justify-end gap-px">
                            <span className="text-muted">$</span>
                            <input
                              type="number"
                              min="0"
                              step="1"
                              value={Math.round(typed ?? l.amount)}
                              onChange={(e) => edit(l, { amount: Math.max(0, Number(e.target.value) || 0) })}
                              aria-label={`Cost of ${l.label}`}
                              style={{ width: `${String(Math.round(typed ?? l.amount)).length + 1.6}ch` }}
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
          <p className="mt-2 text-xs text-muted">
            {costing.panels} panels, {costing.pvKw} kW
            {costing.batteryKwh ? `, ${costing.batteryKwh} kWh battery` : ""}. Costs are ex GST: type over one to change it, or take a line
            out with its cross. An inverter or a battery is costed only when one is chosen on the design. STCs use the rules as at{" "}
            {rates.asOf} and your price per certificate.
            {workspace.lists.length ? ` Prices from: ${workspace.lists.map((l) => l.name).join(", ")}.` : " No price list uploaded yet."}
          </p>
        </div>
      )}
    </section>
  );
}
