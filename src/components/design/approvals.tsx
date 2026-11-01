"use client";

import clsx from "clsx";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { GATES, atGate, daysWaiting, preApprovalOf, solarVicOf, type Gate, type Tone } from "@/lib/domain/design/approvals";
import { PRE_APPROVAL, SOLAR_VIC_STATUS } from "@/lib/domain/design/deal-sections";
import { loadApprovals, saveJob, type JobLine } from "@/lib/services/crm";
import { PATHS, PageHead, ui } from "./design-shell";

const TONE: Record<Tone, string> = { through: "text-positive", waiting: "text-sun-ink", missing: "text-danger" };

/**
 * Procurement → Pre-approvals, Solar Victoria and Book an installation (1 Nov 2026, Martin: Primero's copied across,
 * wave 7): each sold job with no installation date at the first approval gate it hasn't passed, the longest waiting
 * first, with both approvals in words. Each can be set where it stands; setting one through moves the job on to the
 * next gate. Booking a date is done on the deal (its Installation tab) or in Upcoming.
 */
export function ApprovalsPage({ gate }: { gate: Gate }) {
  const [jobs, setJobs] = useState<JobLine[] | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  useEffect(() => {
    let gone = false;
    void loadApprovals().then((res) => {
      if (gone) return;
      if (res.ok) setJobs(res.jobs);
      else setProblem(res.message);
    });
    return () => {
      gone = true;
    };
  }, []);
  const here = GATES.find((g) => g.id === gate)!;
  const now = useMemo(() => new Date(), []);
  const list = jobs ? atGate(jobs, gate) : null;

  const set = async (j: JobLine, key: "preApproval" | "solarVicStatus", value: string) => {
    const details = { ...j.details, [key]: value };
    setJobs((all) => all?.map((x) => (x.id === j.id ? { ...x, details } : x)) ?? null);
    const res = await saveJob(j.id, { details });
    if (!res.ok) setProblem(res.message);
    else window.dispatchEvent(new Event("renuabl:approvals"));
  };

  return (
    <div className={clsx(ui.page, "space-y-5")}>
      <PageHead title={here.label}>
        <span className="text-sm text-muted">{list ? `${list.length} waiting` : ""}</span>
      </PageHead>
      <p className="-mt-2 text-sm text-ink-2">{here.what} A job approved during the sale goes straight past a gate.</p>
      {problem && (
        <p className="rounded-md bg-warning-soft px-4 py-2.5 text-sm text-warning" role="alert">
          {problem}
        </p>
      )}
      {!list ? (
        <p className="text-sm text-muted">Loading…</p>
      ) : !list.length ? (
        <p className={clsx(ui.card, "p-5 text-sm text-ink-2")}>Nothing waiting here.</p>
      ) : (
        <ul className={clsx(ui.card, "divide-y divide-line")}>
          {list.map((j) => {
            const pre = preApprovalOf(j);
            const vic = solarVicOf(j);
            const days = daysWaiting(j, now);
            return (
              <li
                key={j.id}
                className="grid gap-3 px-4 py-3 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)_auto] md:items-center"
              >
                <div className="min-w-0">
                  <Link
                    href={`${PATHS.deals}/${encodeURIComponent(j.id)}`}
                    className="block truncate text-sm font-medium text-ink hover:underline"
                  >
                    {j.customerName} · {j.title}
                  </Link>
                  <p className="truncate text-xs text-muted">
                    {j.address || "No address"}
                    {j.kw ? ` · ${j.kw.toFixed(2)} kW` : ""} · sold {days === 0 ? "today" : `${days} ${days === 1 ? "day" : "days"} ago`}
                  </p>
                </div>
                <label className="text-xs text-muted">
                  Network pre-approval <span className={clsx("font-medium", TONE[pre.tone])}>· {pre.words}</span>
                  <select
                    className={clsx(ui.input, "mt-1 h-9 min-h-9")}
                    value={j.details.preApproval || "Not submitted"}
                    onChange={(e) => void set(j, "preApproval", e.target.value)}
                  >
                    {PRE_APPROVAL.map((v) => (
                      <option key={v}>{v}</option>
                    ))}
                  </select>
                </label>
                <label className="text-xs text-muted">
                  Solar Victoria <span className={clsx("font-medium", TONE[vic.tone])}>· {vic.words}</span>
                  <select
                    className={clsx(ui.input, "mt-1 h-9 min-h-9")}
                    value={j.details.solarVicStatus || "Not applying"}
                    onChange={(e) => void set(j, "solarVicStatus", e.target.value)}
                  >
                    {SOLAR_VIC_STATUS.map((v) => (
                      <option key={v}>{v}</option>
                    ))}
                  </select>
                </label>
                <Link
                  href={`${PATHS.deals}/${encodeURIComponent(j.id)}`}
                  className={clsx(gate === "book" ? ui.primary : ui.quiet, "h-9 px-3")}
                >
                  {gate === "book" ? "Book a date" : "Open deal"}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
