"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, Copy, Download, Mail, PenTool, Plus, Printer, RotateCcw, Truck, X } from "lucide-react";
import clsx from "clsx";
import {
  DEFAULT_PO_INTRO,
  ORDER_STATUSES,
  ORDER_STATUS_LABELS,
  itemKey,
  orderCsv,
  type OrderItem,
  type OrderState,
  type OrderStatus,
} from "@/lib/domain/design/orders";
import { longDay } from "@/lib/domain/design/schedule";
import { dollars, shortDate } from "@/lib/services/crm";
import { emailOrder, listOrders, loadOrder, saveOrder, type JobOrder, type OrderRow } from "@/lib/services/after-sale";
import { PATHS, PageHead, ui } from "./design-shell";

const money2 = (n: number | null) =>
  n === null ? "–" : `$${n.toLocaleString("en-AU", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/**
 * /design/procurement/orders: the Ordering Station. Every signed job's
 * order, the ones still to order first, then ordered and delivered, each
 * with what it comes to and who it is bought from. An order is opened the
 * moment its customer signs.
 */
export function OrdersPage() {
  const [rows, setRows] = useState<OrderRow[] | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  useEffect(() => {
    let gone = false;
    void listOrders().then((res) => {
      if (gone) return;
      if (res.ok) setRows(res.orders);
      else setProblem(res.message);
    });
    return () => {
      gone = true;
    };
  }, []);

  return (
    <div className={ui.page}>
      <PageHead eyebrow="Procurement" title="Ordering Station" />
      <p className="mt-2 max-w-2xl text-sm text-ink-2">
        Each signed job&apos;s bill of materials, counted from the design it was sold with: panels, inverter, battery, rails, splices, roof
        brackets and the electrical parts. Check it, send each supplier their part, and tick it off as it arrives.
      </p>
      {problem && (
        <p className="mt-6 rounded-md bg-warning-soft px-4 py-3 text-sm text-warning" role="alert">
          {problem}
        </p>
      )}
      {!rows && !problem && <p className="mt-8 text-sm text-muted">Loading…</p>}
      {rows && !rows.length && (
        <div className={clsx(ui.card, "mt-6 px-6 py-10 text-center")}>
          <Truck className="mx-auto size-6 text-muted" aria-hidden />
          <p className="mt-3 text-sm text-ink">No orders yet.</p>
          <p className="mt-1 text-sm text-muted">When a customer signs their proposal, its order opens here.</p>
        </div>
      )}
      {ORDER_STATUSES.map((status) => {
        const these = (rows ?? []).filter((r) => r.status === status);
        if (!these.length) return null;
        return (
          <section key={status} className="mt-8" aria-labelledby={`orders-${status}`}>
            <h2 id={`orders-${status}`} className="text-[17px] tracking-tight text-ink">
              {ORDER_STATUS_LABELS[status]} <span className="text-muted">({these.length})</span>
            </h2>
            <ul className={clsx(ui.card, "mt-3 divide-y divide-line")}>
              {these.map((r) => (
                <li key={r.jobId} className="flex flex-wrap items-center gap-x-6 gap-y-2 px-5 py-4">
                  <div className="min-w-[14rem] flex-1">
                    <p className="font-medium text-ink">{r.customer}</p>
                    <p className="truncate text-sm text-muted">{r.address || "No address"}</p>
                    <p className="mt-1 text-xs text-ink-2 tabular-nums">
                      {r.reference} · {r.totals.lines} products · {dollars(r.totals.cost)} ex GST
                      {r.totals.unpriced ? ` · ${r.totals.unpriced} unpriced` : ""}
                      {r.status !== "open" && ` · ticked ${r.totals.ticked} of ${r.totals.lines}`}
                      {r.installDate && ` · installing ${shortDate(r.installDate)}`}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {r.suppliers.map((s) => (
                      <span key={s} className="max-w-[14rem] truncate rounded bg-surface-2 px-2 py-0.5 text-xs text-ink-2" title={s}>
                        {s}
                      </span>
                    ))}
                  </div>
                  <Link href={`${PATHS.orders}/${r.jobId}`} className={ui.primary}>
                    Open the order
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

/**
 * /design/procurement/orders/[jobId]: one job's order. One card for each
 * supplier, with each product's code, how many (the design's count beside
 * any change), the price from that supplier's list, and a tick for when it is
 * ordered; products can be taken off, added, or moved to another supplier
 * that lists them. Changes save as they are made. Each supplier's part can
 * be emailed to them as a purchase order (with no prices), copied, printed
 * or saved as a spreadsheet.
 */
export function OrderPage({ jobId }: { jobId: string }) {
  const [data, setData] = useState<JobOrder | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [saving, setSaving] = useState<"idle" | "saving" | "saved">("idle");
  const timer = useRef<number | null>(null);

  useEffect(() => {
    let gone = false;
    void loadOrder(jobId).then((res) => {
      if (gone) return;
      if (res.ok) setData(res.order);
      else setProblem(res.message);
    });
    return () => {
      gone = true;
    };
  }, [jobId]);

  /** Changes the order on screen straight away and saves it a moment later (so a run of changes is one save). */
  const change = useCallback(
    (next: OrderState, soon = 700) => {
      setData((d) => (d ? { ...d, order: next } : d));
      setSaving("saving");
      if (timer.current) window.clearTimeout(timer.current);
      timer.current = window.setTimeout(async () => {
        const res = await saveOrder(jobId, next);
        if (!res.ok) {
          setProblem(res.message);
          setSaving("idle");
          return;
        }
        setProblem(null);
        setData(res.order);
        setSaving("saved");
      }, soon);
    },
    [jobId],
  );

  if (problem && !data)
    return (
      <div className={ui.page}>
        <Back />
        <p className="mt-6 rounded-md bg-warning-soft px-4 py-3 text-sm text-warning" role="alert">
          {problem}
        </p>
      </div>
    );
  if (!data)
    return (
      <div className={ui.page}>
        <p className="text-sm text-muted">Loading…</p>
      </div>
    );

  const { order } = data;
  const set = (patch: Partial<OrderState>, soon?: number) => change({ ...order, ...patch }, soon);
  const setQty = (item: OrderItem, qty: number | null) => {
    const q = { ...order.qty };
    if (qty === null || qty === item.worked) delete q[item.key];
    else q[item.key] = qty;
    set({ qty: q });
  };
  const tick = (item: OrderItem) =>
    set({ ticked: item.ticked ? order.ticked.filter((k) => k !== item.key) : [...order.ticked, item.key] }, 250);
  const offList = data.items.filter((i) => i.off);

  return (
    <div className={clsx(ui.page, "print:max-w-none print:p-0")}>
      <Back />
      <PageHead eyebrow={`Bill of materials · ${order.reference}`} title={data.customer}>
        <span className="text-xs text-muted" role="status">
          {saving === "saving" ? "Saving…" : saving === "saved" ? "Saved" : ""}
        </span>
        <Link href={`${PATHS.deals}/${data.jobId}`} className={ui.quiet}>
          Open the deal
        </Link>
      </PageHead>
      <p className="mt-1 text-sm text-ink-2">
        {data.address || "No address"}
        {data.signedAt && ` · signed ${shortDate(data.signedAt)}`}
        {data.installDate && ` · installing ${longDay(data.installDate)}`}
      </p>
      {problem && (
        <p className="mt-4 rounded-md bg-warning-soft px-4 py-3 text-sm text-warning" role="alert">
          {problem}
        </p>
      )}

      <div className="mt-6 grid gap-3 sm:grid-cols-4">
        <Stat label="Suppliers" value={String(data.groups.length)} />
        <Stat label="Products" value={String(data.totals.lines)} />
        <Stat label="Ticked off" value={`${data.totals.ticked} of ${data.totals.lines}`} />
        <Stat label="Cost ex GST" value={dollars(data.totals.cost)} />
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-2 print:hidden" role="radiogroup" aria-label="Where the order stands">
        {ORDER_STATUSES.map((s: OrderStatus) => (
          <button
            key={s}
            type="button"
            role="radio"
            aria-checked={order.status === s}
            onClick={() => set({ status: s }, 0)}
            className={clsx(ui.quiet, "h-9", order.status === s && "!border-primary !bg-primary !text-primary-ink")}
          >
            {ORDER_STATUS_LABELS[s]}
          </button>
        ))}
        {order.orderedAt && (
          <span className="text-xs text-muted">
            Marked ordered {shortDate(order.orderedAt)}
            {order.orderedBy ? ` by ${order.orderedBy}` : ""}
            {order.deliveredAt ? ` · delivered ${shortDate(order.deliveredAt)}` : ""}
          </span>
        )}
      </div>
      {data.totals.unpriced > 0 && (
        <p className="mt-4 rounded-md bg-sun px-4 py-2.5 text-sm text-sun-ink print:hidden">
          {data.totals.unpriced} {data.totals.unpriced === 1 ? "product isn't" : "products aren't"} on any of your price lists, so{" "}
          {data.totals.unpriced === 1 ? "it isn't" : "they aren't"} in the cost. Upload a list that carries{" "}
          {data.totals.unpriced === 1 ? "it" : "them"} in Prices and settings.
        </p>
      )}

      {data.groups.map((g) => (
        <SupplierCard
          key={g.list ?? "none"}
          data={data}
          group={g}
          onQty={setQty}
          onTick={tick}
          onSupplier={(item, list) => set({ supplier: { ...order.supplier, [item.key]: list } })}
          onSo={(list, so) => set({ salesOrders: { ...(order.salesOrders ?? {}), [list]: so } })}
        />
      ))}

      {offList.length > 0 && (
        <section className={clsx(ui.card, "mt-6 px-5 py-4 print:hidden")}>
          <h2 className="text-sm font-medium text-ink">Taken off this order</h2>
          <ul className="mt-2 space-y-1 text-sm">
            {offList.map((i) => (
              <li key={i.key} className="flex items-center justify-between gap-3">
                <span className="text-muted line-through">{i.item}</span>
                <button type="button" className={clsx(ui.quiet, "h-8 px-2.5 text-xs")} onClick={() => setQty(i, null)}>
                  <RotateCcw className="size-3.5" aria-hidden /> Put back
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <AddProduct
        onAdd={(item, sku, qty) =>
          set({ added: [...order.added, { key: itemKey({ sku, item, group: "Added" as never }), item, sku, qty }] })
        }
      />

      <section className={clsx(ui.card, "mt-6 grid gap-4 p-5 sm:grid-cols-2 print:hidden")} aria-label="The order's details">
        <label className={ui.label}>
          Order reference
          <input className={clsx(ui.input, "mt-1.5")} value={order.reference} onChange={(e) => set({ reference: e.target.value })} />
        </label>
        <label className={ui.label}>
          Wanted by
          <input type="date" className={clsx(ui.input, "mt-1.5")} value={order.wanted} onChange={(e) => set({ wanted: e.target.value })} />
        </label>
        <label className={ui.label}>
          Deliver to
          <div className="mt-1.5 flex gap-2">
            <input
              className={ui.input}
              value={order.deliverTo}
              onChange={(e) => set({ deliverTo: e.target.value })}
              placeholder="Pick up from the supplier"
            />
            {data.address && (
              <button type="button" className={clsx(ui.quiet, "shrink-0")} onClick={() => set({ deliverTo: data.address })}>
                The home
              </button>
            )}
          </div>
        </label>
        <label className={ui.label}>
          Notes for the supplier
          <input className={clsx(ui.input, "mt-1.5")} value={order.notes} onChange={(e) => set({ notes: e.target.value })} />
        </label>
      </section>

      <div className="mt-6 flex flex-wrap gap-2 print:hidden">
        <button
          type="button"
          className={ui.quiet}
          onClick={() => {
            const blob = new Blob([orderCsv(data.items)], { type: "text/csv" });
            const a = document.createElement("a");
            a.href = URL.createObjectURL(blob);
            a.download = `${order.reference}.csv`;
            a.click();
            URL.revokeObjectURL(a.href);
          }}
        >
          <Download className="size-4" aria-hidden /> Spreadsheet (with costs)
        </button>
        <button type="button" className={ui.quiet} onClick={() => window.print()}>
          <Printer className="size-4" aria-hidden /> Print
        </button>
        <Link href={`${PATHS.designer}?job=${data.jobId}`} className={ui.quiet}>
          <PenTool className="size-4" aria-hidden /> Open the design
        </Link>
      </div>
    </div>
  );
}

function Back() {
  return (
    <Link href={PATHS.orders} className="mb-4 inline-flex items-center gap-1 text-sm text-ink-2 hover:text-ink print:hidden">
      <ChevronLeft className="size-4" aria-hidden /> Ordering Station
    </Link>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className={clsx(ui.card, "px-4 py-3")}>
      <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted">{label}</p>
      <p className="mt-1 text-[20px] tabular-nums text-ink">{value}</p>
    </div>
  );
}

function SupplierCard({
  data,
  group,
  onQty,
  onTick,
  onSupplier,
  onSo,
}: {
  data: JobOrder;
  group: JobOrder["groups"][number];
  onQty: (item: OrderItem, qty: number | null) => void;
  onTick: (item: OrderItem) => void;
  onSupplier: (item: OrderItem, list: string) => void;
  /** The supplier's sales order number for this job, as they gave it. */
  onSo: (list: string, so: string) => void;
}) {
  const [sending, setSending] = useState(false);
  const [copied, setCopied] = useState(false);
  const cost = group.items.reduce((s, i) => s + (i.each ?? 0) * i.qty, 0);
  const text = [
    `${data.order.reference}: ${data.address}`,
    ...group.items.map((i) => `${i.qty} × ${i.item}${i.sku ? ` (${i.sku})` : ""}`),
  ].join("\n");
  return (
    <section className={clsx(ui.card, "mt-6 overflow-hidden")}>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-3">
        <div>
          <h2 className="text-[15px] font-medium text-ink">{group.supplier ? `Buy from ${group.supplier}` : "Not on any price list"}</h2>
          <p className="text-xs text-muted tabular-nums">
            {group.items.length} products · {dollars(cost)} ex GST
          </p>
          {group.list && (
            <label className="mt-1.5 flex items-center gap-2 text-xs text-ink-2">
              SO number
              <input
                key={data.order.salesOrders?.[group.list] ?? ""}
                defaultValue={data.order.salesOrders?.[group.list] ?? ""}
                onBlur={(e) =>
                  e.target.value.trim() !== (data.order.salesOrders?.[group.list!] ?? "") && onSo(group.list!, e.target.value.trim())
                }
                placeholder="From the supplier"
                className="w-36 rounded border border-line bg-surface px-2 py-1 font-mono text-xs text-ink"
              />
            </label>
          )}
        </div>
        <div className="flex flex-wrap gap-2 print:hidden">
          {group.list && (
            <button type="button" className={clsx(ui.primary, "h-9")} onClick={() => setSending((v) => !v)}>
              <Mail className="size-4" aria-hidden /> Email the supplier
            </button>
          )}
          <button
            type="button"
            className={clsx(ui.quiet, "h-9")}
            onClick={() => void navigator.clipboard?.writeText(text).then(() => setCopied(true))}
          >
            <Copy className="size-4" aria-hidden /> {copied ? "Copied" : "Copy this order"}
          </button>
        </div>
      </div>
      {sending && group.list && (
        <SendOrder data={data} list={group.list} supplier={group.supplier ?? group.list} onClose={() => setSending(false)} />
      )}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[44rem] text-sm">
          <thead>
            <tr className="border-b border-line text-left text-[11px] uppercase tracking-[0.12em] text-muted">
              <th className="w-12 px-5 py-2 font-medium">Done</th>
              <th className="px-3 py-2 font-medium">Code</th>
              <th className="px-3 py-2 font-medium">Product</th>
              <th className="px-3 py-2 text-right font-medium">Qty</th>
              <th className="px-3 py-2 text-right font-medium">Each</th>
              <th className="px-3 py-2 text-right font-medium">Total</th>
              <th className="w-10 px-3 py-2 print:hidden" />
            </tr>
          </thead>
          <tbody>
            {group.items.map((i) => (
              <tr key={i.key} className={clsx("border-b border-line last:border-0", i.ticked && "bg-positive-soft/40")}>
                <td className="px-5 py-2">
                  <input
                    type="checkbox"
                    className="size-4 accent-[var(--sun-line)]"
                    checked={i.ticked}
                    onChange={() => onTick(i)}
                    aria-label={`${i.item} ordered`}
                  />
                </td>
                <td className="px-3 py-2 font-mono text-xs text-ink-2">{i.sku || "–"}</td>
                <td className="px-3 py-2 text-ink">
                  {i.item}
                  {i.offers.length > 1 && (
                    <select
                      className="mt-1 block w-full max-w-[16rem] rounded border border-line bg-surface px-1.5 py-1 text-xs text-ink-2 print:hidden"
                      value={i.list ?? ""}
                      onChange={(e) => onSupplier(i, e.target.value)}
                      aria-label={`Supplier for ${i.item}`}
                    >
                      {i.offers.map((o, n) => (
                        <option key={o.list} value={o.list}>
                          {o.supplier} · {money2(o.each)}
                          {n === 0 ? " (preferred)" : ""}
                        </option>
                      ))}
                    </select>
                  )}
                </td>
                <td className="px-3 py-2 text-right">
                  <input
                    type="number"
                    min={0}
                    className="w-20 rounded border border-line bg-surface px-2 py-1 text-right tabular-nums print:border-0"
                    value={i.qty}
                    onChange={(e) => onQty(i, e.target.value === "" ? null : Math.max(0, Math.round(Number(e.target.value))))}
                    aria-label={`How many ${i.item}`}
                  />
                  {i.worked !== null && i.qty !== i.worked && (
                    <button
                      type="button"
                      className="block w-full text-right text-[11px] text-muted underline print:hidden"
                      onClick={() => onQty(i, null)}
                    >
                      design: {i.worked}
                    </button>
                  )}
                </td>
                <td className="px-3 py-2 text-right tabular-nums text-ink-2">{money2(i.each)}</td>
                <td className="px-3 py-2 text-right tabular-nums text-ink">{i.each === null ? "–" : money2(i.each * i.qty)}</td>
                <td className="px-3 py-2 print:hidden">
                  <button
                    type="button"
                    className="text-muted hover:text-danger"
                    onClick={() => onQty(i, 0)}
                    aria-label={`Take ${i.item} off the order`}
                  >
                    <X className="size-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function SendOrder({ data, list, supplier, onClose }: { data: JobOrder; list: string; supplier: string; onClose: () => void }) {
  const [to, setTo] = useState(data.emails[list] ?? "");
  const [intro, setIntro] = useState(DEFAULT_PO_INTRO);
  const [busy, setBusy] = useState(false);
  const [answer, setAnswer] = useState<{ ok: boolean; message: string } | null>(null);
  const send = async () => {
    setBusy(true);
    const res = await emailOrder(data.jobId, { list, to, intro });
    setBusy(false);
    setAnswer(res.ok ? { ok: true, message: res.message } : { ok: false, message: res.message });
  };
  return (
    <div className="border-b border-line bg-surface-2 px-5 py-4">
      <p className="text-sm font-medium text-ink">Purchase order to {supplier}</p>
      <p className="mt-0.5 text-xs text-muted">The codes, products and quantities, with no prices. Replies come to you.</p>
      <div className="mt-3 grid gap-3 sm:grid-cols-[18rem_minmax(0,1fr)]">
        <label className={ui.label}>
          Supplier&apos;s email
          <input
            type="email"
            className={clsx(ui.input, "mt-1.5")}
            value={to}
            onChange={(e) => setTo(e.target.value)}
            placeholder="orders@supplier.com.au"
          />
        </label>
        <label className={ui.label}>
          Your note
          <textarea className={clsx(ui.input, "mt-1.5 min-h-20 py-2")} value={intro} onChange={(e) => setIntro(e.target.value)} />
        </label>
      </div>
      {answer && (
        <p
          className={clsx(
            "mt-3 rounded-md px-3 py-2 text-sm",
            answer.ok ? "bg-positive-soft text-positive" : "bg-warning-soft text-warning",
          )}
          role="status"
        >
          {answer.message}
        </p>
      )}
      <div className="mt-3 flex gap-2">
        <button type="button" className={ui.primary} disabled={busy || !to} onClick={() => void send()}>
          <Mail className="size-4" aria-hidden /> {busy ? "Sending…" : "Send the order"}
        </button>
        <button type="button" className={ui.quiet} onClick={onClose}>
          Close
        </button>
      </div>
    </div>
  );
}

function AddProduct({ onAdd }: { onAdd: (item: string, sku: string, qty: number) => void }) {
  const [open, setOpen] = useState(false);
  const [item, setItem] = useState("");
  const [sku, setSku] = useState("");
  const [qty, setQty] = useState(1);
  if (!open)
    return (
      <button type="button" className={clsx(ui.quiet, "mt-6 print:hidden")} onClick={() => setOpen(true)}>
        <Plus className="size-4" aria-hidden /> Add a product
      </button>
    );
  return (
    <div className={clsx(ui.card, "mt-6 grid gap-3 p-5 sm:grid-cols-[minmax(0,1fr)_10rem_6rem_auto] sm:items-end print:hidden")}>
      <label className={ui.label}>
        Product
        <input className={clsx(ui.input, "mt-1.5")} value={item} onChange={(e) => setItem(e.target.value)} placeholder="Conduit, 20 mm" />
      </label>
      <label className={ui.label}>
        Code (to price it)
        <input className={clsx(ui.input, "mt-1.5")} value={sku} onChange={(e) => setSku(e.target.value)} />
      </label>
      <label className={ui.label}>
        Qty
        <input
          type="number"
          min={1}
          className={clsx(ui.input, "mt-1.5")}
          value={qty}
          onChange={(e) => setQty(Math.max(1, Math.round(Number(e.target.value)) || 1))}
        />
      </label>
      <div className="flex gap-2">
        <button
          type="button"
          className={ui.primary}
          disabled={!item.trim()}
          onClick={() => {
            onAdd(item.trim(), sku.trim(), qty);
            setItem("");
            setSku("");
            setQty(1);
            setOpen(false);
          }}
        >
          Add
        </button>
        <button type="button" className={ui.quiet} onClick={() => setOpen(false)}>
          Cancel
        </button>
      </div>
    </div>
  );
}
