"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Check, Eye, FileSignature, MessageSquare } from "lucide-react";
import clsx from "clsx";
import { dollars, shortDate } from "@/lib/services/crm";
import { listProposals, type ProposalLine } from "@/lib/services/after-sale";
import { PATHS, PageHead, ui } from "./design-shell";

const STATE_WORDS = { live: "Sent", lapsed: "Lapsed", withdrawn: "Taken back", accepted: "Signed" } as const;

/**
 * /design/sales/proposals and /design/sales/signed: each job's newest
 * proposal. Sent shows every one out (opened or not), signed only those the
 * customer has gone ahead with, newest first, each opening its deal, its
 * proposal and its conversation.
 */
export function ProposalsPage({ signed }: { signed: boolean }) {
  const [rows, setRows] = useState<ProposalLine[] | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  useEffect(() => {
    let gone = false;
    void listProposals().then((res) => {
      if (gone) return;
      if (res.ok) setRows(res.proposals);
      else setProblem(res.message);
    });
    return () => {
      gone = true;
    };
  }, []);

  const shown = (rows ?? []).filter((r) => (signed ? r.state === "accepted" : r.state !== "accepted"));
  const value = shown.reduce((s, r) => s + r.youPay, 0);
  const opened = shown.filter((r) => r.openedAt).length;

  return (
    <div className={ui.page}>
      <PageHead eyebrow="Sales" title={signed ? "Signed proposals" : "Proposals sent"}>
        <Link href={signed ? PATHS.proposalsSent : PATHS.proposalsSigned} className={ui.quiet}>
          {signed ? "Proposals sent" : "Signed proposals"}
        </Link>
      </PageHead>
      <p className="mt-2 max-w-2xl text-sm text-ink-2">
        {signed
          ? "Every proposal a customer has signed. Each one opens its order in the Ordering Station and fixes its installation allowance for Installer Invoices."
          : "Every proposal out with a customer and not yet signed, with whether they have opened it."}
      </p>
      {problem && (
        <p className="mt-6 rounded-md bg-warning-soft px-4 py-3 text-sm text-warning" role="alert">
          {problem}
        </p>
      )}
      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        <Tile label={signed ? "Signed" : "Out with customers"} value={rows ? String(shown.length) : "–"} />
        <Tile label="Worth, what customers pay" value={rows ? dollars(value) : "–"} />
        <Tile label={signed ? "Opened before signing" : "Opened"} value={rows ? `${opened} of ${shown.length}` : "–"} />
      </div>
      <div className={clsx(ui.card, "mt-6 overflow-x-auto")}>
        <table className="w-full min-w-[46rem] text-sm">
          <thead>
            <tr className="border-b border-line text-left text-[11px] uppercase tracking-[0.12em] text-muted">
              <th className="px-5 py-3 font-medium">Customer</th>
              <th className="px-3 py-3 font-medium">System</th>
              <th className="px-3 py-3 text-right font-medium">They pay</th>
              <th className="px-3 py-3 font-medium">{signed ? "Signed" : "Sent"}</th>
              <th className="px-3 py-3 font-medium">Where it stands</th>
              <th className="px-5 py-3" />
            </tr>
          </thead>
          <tbody>
            {rows && !shown.length && (
              <tr>
                <td colSpan={6} className="px-5 py-10 text-center text-muted">
                  {signed ? "No proposal has been signed yet." : "No proposal is out with a customer just now."}
                </td>
              </tr>
            )}
            {!rows && !problem && (
              <tr>
                <td colSpan={6} className="px-5 py-10 text-center text-muted">
                  Loading…
                </td>
              </tr>
            )}
            {shown.map((r) => (
              <tr key={r.jobId} className="border-b border-line last:border-0">
                <td className="px-5 py-3">
                  <Link href={`${PATHS.deals}/${r.jobId}`} className="font-medium text-ink hover:underline">
                    {r.customer}
                  </Link>
                  <span className="block max-w-[16rem] truncate text-xs text-muted">{r.address || r.title}</span>
                </td>
                <td className="px-3 py-3 tabular-nums text-ink-2">
                  {r.system}
                  <span className="block text-xs text-muted">Version {r.version}</span>
                </td>
                <td className="px-3 py-3 text-right tabular-nums text-ink">{dollars(r.youPay)}</td>
                <td className="px-3 py-3 tabular-nums text-ink-2">
                  {shortDate(signed ? r.acceptedAt! : r.publishedAt)}
                  {signed && r.acceptedName && <span className="block text-xs text-muted">by {r.acceptedName}</span>}
                </td>
                <td className="px-3 py-3">
                  <span
                    className={clsx(
                      "inline-flex items-center gap-1.5 rounded px-2 py-1 text-xs font-medium",
                      r.state === "accepted"
                        ? "bg-positive-soft text-positive"
                        : r.state === "live"
                          ? "bg-sun text-sun-ink"
                          : "bg-surface-2 text-muted",
                    )}
                  >
                    {r.state === "accepted" ? <FileSignature className="size-3.5" aria-hidden /> : null}
                    {STATE_WORDS[r.state]}
                  </span>
                  {!signed && (
                    <span className="mt-1 flex items-center gap-1 text-xs text-muted">
                      {r.openedAt ? (
                        <>
                          <Eye className="size-3.5" aria-hidden /> Opened {shortDate(r.openedAt)}
                        </>
                      ) : (
                        "Not opened yet"
                      )}
                    </span>
                  )}
                </td>
                <td className="px-5 py-3">
                  <div className="flex justify-end gap-2">
                    <Link href={`${PATHS.deals}/${r.jobId}?tab=chat`} className={clsx(ui.quiet, "h-8 px-2.5 text-xs")} title="Messages">
                      <MessageSquare className="size-3.5" aria-hidden /> Chat
                    </Link>
                    {signed ? (
                      <Link href={`${PATHS.orders}/${r.jobId}`} className={clsx(ui.quiet, "h-8 px-2.5 text-xs")}>
                        <Check className="size-3.5" aria-hidden /> Order
                      </Link>
                    ) : (
                      <a href={r.path} target="_blank" rel="noreferrer" className={clsx(ui.quiet, "h-8 px-2.5 text-xs")}>
                        View
                      </a>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function Tile({ label, value, tone }: { label: string; value: string; tone?: "over" | "under" }) {
  return (
    <div className={clsx(ui.card, "px-5 py-4")}>
      <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted">{label}</p>
      <p
        className={clsx(
          "mt-1.5 text-[24px] tabular-nums tracking-tight",
          tone === "over" ? "text-danger" : tone === "under" ? "text-positive" : "text-ink",
        )}
      >
        {value}
      </p>
    </div>
  );
}
