"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ChevronLeft, Copy, Download, Printer } from "lucide-react";
import clsx from "clsx";
import type { Customer, Job } from "@/lib/domain/design/crm";
import { materialsCsv, materialsOrder, type MaterialLine } from "@/lib/domain/design/deal";
import { workspaceCatalogue } from "@/lib/domain/design/pricing";
import { costSystem } from "@/lib/domain/design/quote";
import { systemSpecOf } from "@/lib/domain/design/system";
import { loadDealDesign, loadJob, shortDate } from "@/lib/services/crm";
import { loadWorkspace } from "@/lib/services/design-store";
import { useDesignAccount } from "./design-account";
import { STAGE_LABELS, WON_STAGES } from "@/lib/domain/design/crm";
import { PATHS, ui } from "./design-shell";

/**
 * /design/deals/[id]/materials: a job's bill of materials as the sheet to
 * send to a supplier: every hardware line of its quote (the same lines, so
 * what is ordered is what was sold), with its code and how many, and no
 * prices. It can be printed (or saved as a PDF from the print box), saved as
 * a spreadsheet file, or copied. Meant for a deal that is won, and says so
 * when it isn't; it is always worked out from the design as it stands now.
 */
export function DealMaterials({ id }: { id: string }) {
  const [account] = useDesignAccount();
  const [job, setJob] = useState<Job | null>(null);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [lines, setLines] = useState<MaterialLine[] | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let gone = false;
    void (async () => {
      const res = await loadJob(id);
      if (gone) return;
      if (!res.ok) return setProblem(res.message);
      setJob(res.job);
      setCustomer(res.customer);
      if (!res.job.projectId) return setLines([]);
      const [found, workspace] = await Promise.all([loadDealDesign(res.job.projectId), loadWorkspace().catch(() => null)]);
      if (gone) return;
      if (!found || !workspace) return setProblem("The design or your prices couldn't be loaded just now. Try again in a moment.");
      const spec = systemSpecOf(found.design, workspaceCatalogue(workspace).panels?.[0]);
      setLines(materialsOrder(costSystem(spec, found.form, workspace).lines, found.edits));
    })();
    return () => {
      gone = true;
    };
  }, [id]);

  if (problem)
    return (
      <div className={ui.page}>
        <p className="rounded-md bg-warning-soft px-4 py-3 text-sm text-warning" role="alert">
          {problem}
        </p>
      </div>
    );
  if (!job || !customer || !lines) return <div className={ui.page} aria-busy="true" />;

  const business = account?.signedIn ? (account.business?.name ?? "") : "";
  const csv = materialsCsv(lines);
  const file = `materials-${
    customer.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "order"
  }.csv`;
  const groups = [...new Set(lines.map((l) => l.group))];
  const sold = WON_STAGES.includes(job.stage);

  return (
    <div className={clsx(ui.page, "max-w-4xl")}>
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Link href={`${PATHS.deals}/${id}`} className="inline-flex items-center gap-1.5 text-sm font-medium text-ink hover:underline">
          <ChevronLeft className="size-4 text-muted" aria-hidden /> Back to the deal
        </Link>
        {lines.length > 0 && (
          <div className="flex flex-wrap gap-2">
            <button className={ui.quiet} onClick={() => window.print()}>
              <Printer className="size-4" aria-hidden /> Print or save as PDF
            </button>
            <a className={ui.quiet} href={`data:text/csv;charset=utf-8,${encodeURIComponent("\ufeff" + csv)}`} download={file}>
              <Download className="size-4" aria-hidden /> Spreadsheet (CSV)
            </a>
            <button
              className={ui.quiet}
              onClick={() =>
                void navigator.clipboard
                  .writeText(lines.map((l) => `${l.qty}\t${l.sku}\t${l.item}`).join("\n"))
                  .then(() => setCopied(true))
                  .catch(() => setCopied(false))
              }
            >
              <Copy className="size-4" aria-hidden /> {copied ? "Copied" : "Copy"}
            </button>
          </div>
        )}
      </div>

      {!sold && (
        <p className="mt-4 rounded-md bg-sun px-4 py-3 text-sm text-sun-ink print:hidden" role="status">
          This deal is at {STAGE_LABELS[job.stage]}, not yet won. The sheet is here to look at, but order from it once the customer has gone
          ahead.
        </p>
      )}

      <article className={clsx(ui.card, "mt-4 p-6 sm:p-8 print:mt-0 print:p-0 print:shadow-none print:ring-0")}>
        <header className="flex flex-wrap items-start justify-between gap-4 border-b-2 border-ink pb-4">
          <div>
            <p className={ui.eyebrow}>Materials order</p>
            <h1 className="mt-1 text-[24px] leading-tight tracking-tight text-ink">{business || "Materials order"}</h1>
          </div>
          <dl className="text-right text-sm">
            <dt className="sr-only">Date</dt>
            <dd className="tabular-nums text-ink">{shortDate(new Date().toISOString())}</dd>
            {job.installDate && (
              <>
                <dt className="mt-1 text-xs text-muted">Install date</dt>
                <dd className="tabular-nums text-ink">{shortDate(job.installDate)}</dd>
              </>
            )}
          </dl>
        </header>
        <dl className="mt-4 grid gap-x-8 gap-y-2 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-xs text-muted">Job</dt>
            <dd className="text-ink">
              {customer.name} · {job.title}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted">Site</dt>
            <dd className="text-ink">{job.address || "No address"}</dd>
          </div>
        </dl>

        {lines.length === 0 ? (
          <p className="mt-6 text-sm text-ink-2">
            {job.projectId
              ? "Nothing is on this job's design yet."
              : "This job has no design yet: its materials are worked out from the design."}
          </p>
        ) : (
          <table className="mt-6 w-full text-left text-sm">
            <thead>
              <tr className="border-b border-line text-[11px] font-medium uppercase tracking-[0.12em] text-muted">
                <th className="w-16 py-2 pr-3 text-right font-medium">Qty</th>
                <th className="w-48 px-3 py-2 font-medium">Code</th>
                <th className="py-2 pl-3 font-medium">Item</th>
              </tr>
            </thead>
            {groups.map((group) => (
              <tbody key={group}>
                <tr>
                  <th colSpan={3} className="pb-1 pt-4 text-left text-[11px] font-semibold uppercase tracking-[0.14em] text-ink">
                    {group}
                  </th>
                </tr>
                {lines
                  .filter((l) => l.group === group)
                  .map((l, i) => (
                    <tr key={`${l.sku}${i}`} className="border-b border-line align-top">
                      <td className="py-2 pr-3 text-right font-semibold tabular-nums text-ink">{l.qty}</td>
                      <td className="break-all px-3 py-2 tabular-nums text-ink-2">{l.sku || "–"}</td>
                      <td className="py-2 pl-3 text-ink">{l.item}</td>
                    </tr>
                  ))}
              </tbody>
            ))}
          </table>
        )}
        <p className="mt-6 text-xs leading-relaxed text-muted">
          Worked out from the design and quote as they stand today, by the same rules as the quote. Check it against the roof and your own
          stock before ordering. Prices are left off.
        </p>
      </article>
    </div>
  );
}
