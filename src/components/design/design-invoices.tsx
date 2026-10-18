"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { FileUp, ReceiptText, RotateCcw, Trash2 } from "lucide-react";
import clsx from "clsx";
import { LIKELY_MATCH, VARIANCE_LABELS, varianceText, type InstallerInvoice, type Variance } from "@/lib/domain/design/installer-invoices";
import { dollars, shortDate } from "@/lib/services/crm";
import {
  addInvoice,
  assignInvoice,
  deleteInvoice,
  loadInvoices,
  readInvoice,
  workOutAgain,
  type InvoiceFigures,
  type InvoicesView,
} from "@/lib/services/after-sale";
import { Tile } from "./design-proposals-list";
import { PATHS, PageHead, ui } from "./design-shell";

const money2 = (n: number) => `$${n.toLocaleString("en-AU", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const FILTERS = ["all", "over", "under", "match", "awaiting"] as const;
type Filter = (typeof FILTERS)[number];

/**
 * /design/installations/invoices: Installer Invoices. For every signed job,
 * what its installation was allowed for in the quote (fixed when the customer
 * signed) against what the installer billed, and the difference: within the
 * business's tolerance it matches. An invoice is uploaded and read (or typed
 * in), checked, and kept against its job; only its figures are kept, never
 * the file.
 */
export function InvoicesPage() {
  const [data, setData] = useState<InvoicesView | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [open, setOpen] = useState<string | null>(null);
  const [adding, setAdding] = useState<string | null | undefined>(undefined);

  const reload = useCallback(async () => {
    const res = await loadInvoices();
    if (res.ok) {
      setData(res);
      setProblem(null);
    } else setProblem(res.message);
  }, []);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void reload();
  }, [reload]);

  const rows = data?.rows ?? [];
  const count = (v: Variance) => rows.filter((r) => r.status === v).length;
  const sum = (v: Variance) => rows.filter((r) => r.status === v).reduce((s, r) => s + Math.abs(r.difference ?? 0), 0);
  const shown = filter === "all" ? rows : rows.filter((r) => r.status === filter);

  return (
    <div className={ui.page}>
      <PageHead eyebrow="Installations" title="Installer Invoices">
        <button type="button" className={ui.primary} onClick={() => setAdding(null)}>
          <FileUp className="size-4" aria-hidden /> Upload an invoice
        </button>
      </PageHead>
      <p className="mt-2 max-w-2xl text-sm text-ink-2">
        Each signed job&apos;s installation, as your quote allowed for it, against your installer&apos;s invoice. All figures ex GST; within{" "}
        {data ? dollars(data.tolerance) : "your tolerance"} it matches (set in Prices and settings).
      </p>
      {problem && (
        <p className="mt-4 rounded-md bg-warning-soft px-4 py-3 text-sm text-warning" role="alert">
          {problem}
        </p>
      )}
      {adding !== undefined && data && (
        <AddInvoice
          jobs={rows.map((r) => ({ jobId: r.jobId, customer: r.customer }))}
          jobId={adding}
          onDone={() => {
            setAdding(undefined);
            void reload();
          }}
        />
      )}

      <div className="mt-6 grid gap-3 sm:grid-cols-5">
        <Tile label="Signed jobs" value={data ? String(rows.length) : "–"} />
        <Tile label="Invoiced" value={data ? `${rows.length - count("awaiting")} of ${rows.length}` : "–"} />
        <Tile label="Over" value={data ? dollars(sum("over")) : "–"} tone="over" />
        <Tile label="Under" value={data ? dollars(sum("under")) : "–"} tone="under" />
        <Tile label="Awaiting" value={data ? String(count("awaiting")) : "–"} />
      </div>

      <div className="mt-6 flex flex-wrap gap-2" role="tablist">
        {FILTERS.map((f) => (
          <button
            key={f}
            type="button"
            role="tab"
            aria-selected={filter === f}
            className={clsx(ui.quiet, "h-8 px-3 text-xs", filter === f && "!border-primary !bg-primary !text-primary-ink")}
            onClick={() => setFilter(f)}
          >
            {f === "all" ? "All" : f === "match" ? "Matches" : VARIANCE_LABELS[f]} ({f === "all" ? rows.length : count(f)})
          </button>
        ))}
      </div>

      <ul className={clsx(ui.card, "mt-4 divide-y divide-line")}>
        {data && !shown.length && <li className="px-5 py-10 text-center text-sm text-muted">Nothing here.</li>}
        {!data && !problem && <li className="px-5 py-10 text-center text-sm text-muted">Loading…</li>}
        {shown.map((r) => (
          <li key={r.jobId} className="px-5 py-4">
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
              <div className="min-w-0 flex-1">
                <Link href={`${PATHS.deals}/${r.jobId}`} className="font-medium text-ink hover:underline">
                  {r.customer}
                </Link>
                <p className="truncate text-sm text-muted">{r.address || "No address"}</p>
                <p className="text-xs text-ink-2">
                  {r.signedAt ? `Signed ${shortDate(r.signedAt)}` : ""}
                  {r.installDate ? ` · installing ${shortDate(r.installDate)}` : ""}
                </p>
              </div>
              <Figure label="Quote allowed" value={r.cost ? money2(r.cost.total) : "–"} />
              <Figure label="Installer billed" value={r.billed === null ? "–" : money2(r.billed)} />
              <span
                className={clsx(
                  "rounded px-2 py-1 text-xs font-medium",
                  r.status === "over"
                    ? "bg-warning-soft text-danger"
                    : r.status === "under"
                      ? "bg-positive-soft text-positive"
                      : r.status === "match"
                        ? "bg-surface-2 text-ink"
                        : "bg-sun text-sun-ink",
                )}
              >
                {varianceText(r)}
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  className={clsx(ui.quiet, "h-8 px-2.5 text-xs")}
                  onClick={() => setOpen(open === r.jobId ? null : r.jobId)}
                >
                  Compare
                </button>
                <button type="button" className={clsx(ui.quiet, "h-8 px-2.5 text-xs")} onClick={() => setAdding(r.jobId)}>
                  <FileUp className="size-3.5" aria-hidden /> Invoice
                </button>
              </div>
            </div>
            {open === r.jobId && (
              <div className="mt-4 grid gap-4 rounded-md bg-surface-2 p-4 sm:grid-cols-2">
                <div>
                  <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted">In the quote</p>
                  <ul className="mt-2 space-y-1 text-sm">
                    {(r.cost?.lines ?? []).map((l) => (
                      <li key={l.label} className="flex justify-between gap-3">
                        <span className="text-ink-2">{l.label}</span>
                        <span className="tabular-nums">{money2(l.amount)}</span>
                      </li>
                    ))}
                    <li className="flex justify-between border-t border-line pt-1 font-medium">
                      <span>Allowed</span>
                      <span className="tabular-nums">{r.cost ? money2(r.cost.total) : "–"}</span>
                    </li>
                  </ul>
                  <button
                    type="button"
                    className="mt-3 inline-flex items-center gap-1 text-xs text-ink-2 underline"
                    onClick={() => void workOutAgain(r.jobId).then(() => reload())}
                  >
                    <RotateCcw className="size-3.5" aria-hidden /> Work it out again from the signed proposal
                  </button>
                </div>
                <div>
                  <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted">
                    On the invoice{r.invoices.length > 1 ? "s" : ""}
                  </p>
                  {!r.invoices.length && <p className="mt-2 text-sm text-muted">No invoice yet.</p>}
                  {r.invoices.map((inv) => (
                    <InvoiceLines key={inv.id} invoice={inv} onRemove={() => void assignInvoice(inv.id, null).then(() => reload())} />
                  ))}
                  {r.difference !== null && (
                    <p className="mt-2 text-sm font-medium text-ink">
                      Difference: {r.difference >= 0 ? "+" : "-"}
                      {money2(Math.abs(r.difference))} ({money2(r.billed ?? 0)} billed less {money2(r.cost?.total ?? 0)} allowed)
                    </p>
                  )}
                </div>
              </div>
            )}
          </li>
        ))}
      </ul>

      {data && data.waiting.length > 0 && (
        <section className="mt-8" aria-labelledby="waiting">
          <h2 id="waiting" className="text-[17px] tracking-tight text-ink">
            Invoices not put against a job
          </h2>
          <ul className={clsx(ui.card, "mt-3 divide-y divide-line")}>
            {data.waiting.map((inv) => (
              <li key={inv.id} className="flex flex-wrap items-center gap-4 px-5 py-3 text-sm">
                <span className="min-w-0 flex-1">
                  <span className="font-medium text-ink">{inv.installer || "Installer"}</span> · {inv.number || "no number"} ·{" "}
                  {money2(inv.subTotal)} ex GST
                  {inv.suggestions[0] && inv.suggestions[0].score >= LIKELY_MATCH && (
                    <span className="block text-xs text-muted">Looks like {inv.suggestions[0].customer}&apos;s job.</span>
                  )}
                </span>
                <select
                  className="rounded border border-line bg-surface px-2 py-1.5 text-sm"
                  defaultValue=""
                  onChange={(e) => e.target.value && void assignInvoice(inv.id, e.target.value).then(() => reload())}
                  aria-label="Put against a job"
                >
                  <option value="">Put against a job…</option>
                  {[
                    ...inv.suggestions.map((s) => ({ jobId: s.jobId, customer: `${s.customer} (likely)` })),
                    ...rows.filter((r) => !inv.suggestions.some((s) => s.jobId === r.jobId)),
                  ].map((j) => (
                    <option key={j.jobId} value={j.jobId}>
                      {j.customer}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  className="text-muted hover:text-danger"
                  onClick={() => void deleteInvoice(inv.id).then(() => reload())}
                  aria-label="Delete this invoice"
                >
                  <Trash2 className="size-4" />
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function Figure({ label, value }: { label: string; value: string }) {
  return (
    <div className="text-right">
      <p className="text-[11px] uppercase tracking-[0.12em] text-muted">{label}</p>
      <p className="tabular-nums text-ink">{value}</p>
    </div>
  );
}

function InvoiceLines({ invoice, onRemove }: { invoice: InstallerInvoice; onRemove: () => void }) {
  return (
    <div className="mt-2 text-sm">
      <p className="text-xs text-muted">
        {invoice.installer || "Installer"} · {invoice.number || "no number"}
        {invoice.date ? ` · ${shortDate(invoice.date)}` : ""} ·{" "}
        <button type="button" className="underline" onClick={onRemove}>
          Not this job&apos;s
        </button>
      </p>
      <ul className="mt-1 space-y-1">
        {invoice.lines.map((l, i) => (
          <li key={i} className="flex justify-between gap-3">
            <span className="text-ink-2">{l.description}</span>
            <span className="tabular-nums">{money2(l.amount)}</span>
          </li>
        ))}
        <li className="flex justify-between border-t border-line pt-1 font-medium">
          <span>Billed ex GST</span>
          <span className="tabular-nums">{money2(invoice.subTotal)}</span>
        </li>
      </ul>
    </div>
  );
}

/** Upload an invoice (read for its figures) or type it in, check it, and keep it against a job or to put against one later. */
function AddInvoice({ jobs, jobId, onDone }: { jobs: { jobId: string; customer: string }[]; jobId: string | null; onDone: () => void }) {
  const [figures, setFigures] = useState<InvoiceFigures>({ installer: "", number: "", date: "", subTotal: 0, gst: 0, lines: [] });
  const [fileName, setFileName] = useState("");
  const [job, setJob] = useState<string>(jobId ?? "");
  const [busy, setBusy] = useState<"reading" | "saving" | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const read = async (file: File) => {
    setBusy("reading");
    setMessage(null);
    setFileName(file.name);
    const res = await readInvoice(file);
    setBusy(null);
    if (!res.ok) return setMessage(res.message);
    setFigures(res.figures);
    setMessage(res.complete ? "Read. Check the figures before you keep it." : "Some figures couldn't be read. Fill them in below.");
  };
  const save = async () => {
    setBusy("saving");
    const res = await addInvoice({ jobId: job || null, figures, fileName });
    setBusy(null);
    if (!res.ok) return setMessage(res.message);
    onDone();
  };
  const field = (key: "installer" | "number" | "date", label: string, type = "text") => (
    <label className={ui.label}>
      {label}
      <input
        type={type}
        className={clsx(ui.input, "mt-1.5")}
        value={figures[key]}
        onChange={(e) => setFigures({ ...figures, [key]: e.target.value })}
      />
    </label>
  );

  return (
    <section className={clsx(ui.card, "mt-6 p-5")} aria-label="Add an installer's invoice">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-[15px] font-medium text-ink">
          <ReceiptText className="size-4" aria-hidden /> An installer&apos;s invoice
        </h2>
        <label className={clsx(ui.quiet, "cursor-pointer")}>
          <FileUp className="size-4" aria-hidden />{" "}
          {busy === "reading" ? "Reading…" : fileName ? "Read another file" : "Choose the PDF or photo"}
          <input
            type="file"
            accept="application/pdf,image/jpeg,image/png,image/webp"
            className="sr-only"
            onChange={(e) => e.target.files?.[0] && void read(e.target.files[0])}
          />
        </label>
      </div>
      <p className="mt-1 text-xs text-muted">The file is read for its figures and not kept. Or type them in.</p>
      {message && <p className="mt-3 rounded-md bg-surface-2 px-3 py-2 text-sm text-ink-2">{message}</p>}
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        {field("installer", "From (the installer)")}
        {field("number", "Invoice number")}
        {field("date", "Date", "date")}
        <label className={ui.label}>
          Total ex GST
          <input
            type="number"
            min={0}
            step="0.01"
            className={clsx(ui.input, "mt-1.5 tabular-nums")}
            value={figures.subTotal || ""}
            onChange={(e) => setFigures({ ...figures, subTotal: Number(e.target.value) || 0 })}
          />
        </label>
        <label className={ui.label}>
          GST
          <input
            type="number"
            min={0}
            step="0.01"
            className={clsx(ui.input, "mt-1.5 tabular-nums")}
            value={figures.gst || ""}
            onChange={(e) => setFigures({ ...figures, gst: Number(e.target.value) || 0 })}
          />
        </label>
        <label className={ui.label}>
          The job
          <select className={clsx(ui.input, "mt-1.5")} value={job} onChange={(e) => setJob(e.target.value)}>
            <option value="">Decide later</option>
            {jobs.map((j) => (
              <option key={j.jobId} value={j.jobId}>
                {j.customer}
              </option>
            ))}
          </select>
        </label>
      </div>
      {figures.lines.length > 0 && (
        <ul className="mt-4 space-y-1 text-sm">
          {figures.lines.map((l, i) => (
            <li key={i} className="flex justify-between gap-3">
              <span className="text-ink-2">{l.description}</span>
              <span className="tabular-nums">{money2(l.amount)}</span>
            </li>
          ))}
        </ul>
      )}
      <div className="mt-4 flex gap-2">
        <button type="button" className={ui.primary} disabled={busy !== null || !(figures.subTotal > 0)} onClick={() => void save()}>
          {busy === "saving" ? "Keeping…" : "Keep this invoice"}
        </button>
        <button type="button" className={ui.quiet} onClick={onDone}>
          Cancel
        </button>
      </div>
    </section>
  );
}
