"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { FileUp, ReceiptText } from "lucide-react";
import clsx from "clsx";
import { varianceText } from "@/lib/domain/design/installer-invoices";
import { shortDate } from "@/lib/services/crm";
import { loadInvoices, type InvoicesView } from "@/lib/services/after-sale";
import { PATHS, ui } from "./design-shell";

const money2 = (n: number) => `$${n.toLocaleString("en-AU", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
type Row = InvoicesView["rows"][number];

/**
 * The installer's invoice on the deal's Installation tab (26 Nov 2026, Martin: "we need installer invoices to be
 * findable under the customers deal page"): what the quote allowed for the installation, what the installer billed,
 * how they compare, and each invoice kept against the job, read from Installer Invoices. Shown only to someone who sees
 * costs (the route refuses anyone else, and then nothing is drawn) and only once the deal is signed. Uploading and
 * comparing line by line stay on Installer Invoices, opened on this job.
 */
export function DealInstallerInvoice({ jobId }: { jobId: string }) {
  const [row, setRow] = useState<Row | null | "none">(null);
  useEffect(() => {
    let live = true;
    void loadInvoices().then((res) => {
      if (!live) return;
      setRow(res.ok ? (res.rows.find((r) => r.jobId === jobId) ?? "none") : "none");
    });
    return () => {
      live = false;
    };
  }, [jobId]);
  if (row === null || row === "none") return null;
  const open = `${PATHS.invoices}?job=${encodeURIComponent(jobId)}`;
  return (
    <section className={clsx(ui.card, "mt-6 p-4")} aria-label="Installer invoice">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
        <h3 className="flex min-w-[10rem] flex-1 items-center gap-2 text-sm font-semibold text-ink">
          <ReceiptText className="size-4 text-muted" aria-hidden /> Installer invoice
        </h3>
        <Figure label="Quote allowed" value={row.cost ? money2(row.cost.total) : "–"} />
        <Figure label="Installer billed" value={row.billed === null ? "–" : money2(row.billed)} />
        <span
          className={clsx(
            "rounded px-2 py-1 text-xs font-medium",
            row.status === "over"
              ? "bg-warning-soft text-danger"
              : row.status === "under"
                ? "bg-positive-soft text-positive"
                : row.status === "match"
                  ? "bg-surface-2 text-ink"
                  : "bg-sun text-sun-ink",
          )}
        >
          {varianceText(row)}
        </span>
        <Link href={open} className={clsx(ui.quiet, "h-8 px-2.5 text-xs")}>
          <FileUp className="size-3.5" aria-hidden /> {row.invoices.length ? "Compare" : "Add the invoice"}
        </Link>
      </div>
      {row.invoices.length > 0 && (
        <ul className="mt-3 divide-y divide-line border-t border-line text-sm">
          {row.invoices.map((i) => (
            <li key={i.id} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5 py-2">
              <span className="min-w-0 text-ink">
                {i.installer || "Installer"}
                {i.number ? ` · #${i.number}` : ""}
                {i.date ? <span className="text-muted"> · {shortDate(i.date)}</span> : null}
              </span>
              <span className="tabular-nums text-ink-2">{money2(i.subTotal)} ex GST</span>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-2 text-xs text-muted">All figures ex GST.</p>
    </section>
  );
}

function Figure({ label, value }: { label: string; value: string }) {
  return (
    <div className="text-right">
      <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted">{label}</p>
      <p className="mt-0.5 text-[15px] tabular-nums text-ink">{value}</p>
    </div>
  );
}
