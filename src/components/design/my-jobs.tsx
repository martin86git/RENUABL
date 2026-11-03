"use client";

import clsx from "clsx";
import { ArrowRight, BatteryFull, Check, Home, MapPin, Package, Phone, PlugZap, Store, Sun } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type { SharedJobLine } from "@/lib/domain/design/job-shares";
import { JOB_PERIODS, cleanPeriod, emptyWords, sheetsFor, type JobPeriod, type JobSheet } from "@/lib/domain/design/my-jobs";
import { ROOF_IMAGE } from "@/lib/domain/design/roof-design";
import type { ISODate } from "@/lib/domain/types";
import { answerInstallerJob, loadMyJobs, sheetRoofHref } from "@/lib/services/job-shares";
import { PageHead, ui } from "./design-shell";
import { Line } from "./installer-jobs";

const PERIOD_KEY = "renuabl.design.my-jobs-period";
const mapLink = (address: string) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
const longDay = (iso: string) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-AU", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });
const KIT_WORDS = { panel: "Panels", inverter: "Inverter", battery: "Battery" } as const;

/**
 * An installer's home (2 Nov 2026, Martin: My Jobs): the jobs waiting for an answer, then the accepted ones for Today,
 * Tomorrow, This week or This month, each as a sheet with its roof and everything the crew needs
 * (domain/design/my-jobs.ts). Jobs with no day yet are listed under them.
 */
export function MyJobsPage() {
  const [data, setData] = useState<{ jobs: SharedJobLine[]; sheets: JobSheet[]; today: ISODate } | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [period, setPeriod] = useState<JobPeriod>("today");
  const load = useCallback(() => {
    void loadMyJobs().then((res) =>
      res.ok ? setData({ jobs: res.jobs, sheets: res.sheets, today: res.today as ISODate }) : setProblem(res.message),
    );
  }, []);
  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPeriod(cleanPeriod(localStorage.getItem(PERIOD_KEY)));
    } catch {
      // Storage is off: Today it is.
    }
    load();
  }, [load]);
  const pick = (p: JobPeriod) => {
    setPeriod(p);
    try {
      localStorage.setItem(PERIOD_KEY, p);
    } catch {
      // Kept for this visit only.
    }
  };
  const act = async (id: string, action: "accept" | "decline") => {
    const res = await answerInstallerJob(id, action);
    if (!res.ok) return setProblem(res.message);
    setProblem(null);
    window.dispatchEvent(new Event("renuabl:installer-jobs"));
    load();
  };

  const waiting = data?.jobs.filter((j) => j.state === "sent") ?? [];
  const { shown, undated } = data ? sheetsFor(data.sheets, period, data.today) : { shown: [], undated: [] };
  const counts = data ? Object.fromEntries(JOB_PERIODS.map((p) => [p.id, sheetsFor(data.sheets, p.id, data.today).shown.length])) : {};

  return (
    <div className={clsx(ui.page, "space-y-6")}>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <PageHead title="My Jobs" />
        <div role="tablist" aria-label="Which jobs" className="flex rounded-full bg-surface p-1 ring-1 ring-line">
          {JOB_PERIODS.map((p) => (
            <button
              key={p.id}
              role="tab"
              aria-selected={period === p.id}
              onClick={() => pick(p.id)}
              className={clsx(
                "inline-flex h-9 items-center gap-1.5 rounded-full px-4 text-sm font-medium transition",
                period === p.id ? "bg-primary text-primary-ink" : "text-ink-2 hover:text-ink",
              )}
            >
              {p.label}
              {counts[p.id] ? (
                <span className={clsx("tabular-nums", period === p.id ? "text-sun-bright" : "text-muted")}>{counts[p.id]}</span>
              ) : null}
            </button>
          ))}
        </div>
      </div>
      {problem && (
        <p className="rounded-md bg-warning-soft px-4 py-2.5 text-sm text-warning" role="alert">
          {problem}
        </p>
      )}
      {!data ? (
        <p className="text-sm text-muted">Loading…</p>
      ) : (
        <>
          {waiting.length > 0 && (
            <section className={clsx(ui.card, "p-5")}>
              <p className={ui.eyebrow}>Waiting for your answer</p>
              <ul className="mt-3 divide-y divide-line">
                {waiting.map((j) => (
                  <li key={j.id} className="flex flex-wrap items-center gap-3 py-3">
                    <Line job={j} />
                    <div className="ml-auto flex gap-2">
                      <button type="button" onClick={() => void act(j.id, "accept")} className={clsx(ui.primary, "h-9")}>
                        <Check className="size-4" aria-hidden /> Accept
                      </button>
                      <button type="button" onClick={() => void act(j.id, "decline")} className={clsx(ui.quiet, "h-9")}>
                        Decline
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-xs text-muted">The address and the customer&apos;s details open once you accept.</p>
            </section>
          )}
          {shown.length ? (
            <ul className="space-y-5">
              {shown.map((s) => (
                <li key={s.id}>
                  <Sheet sheet={s} />
                </li>
              ))}
            </ul>
          ) : (
            <div className={clsx(ui.card, "p-6")}>
              <p className="text-[15px] text-ink">{emptyWords(period)}</p>
              {!data.sheets.length && !waiting.length && (
                <p className="mt-1 text-sm text-ink-2">
                  Jobs reach you from the retailers you&apos;re connected with, or from a bid you win on the Marketplace.{" "}
                  <Link href="/design/connections" className={ui.link}>
                    Your connections
                  </Link>
                  .
                </p>
              )}
            </div>
          )}
          {undated.length > 0 && (
            <section className={clsx(ui.card, "p-5")}>
              <p className={ui.eyebrow}>No installation day yet</p>
              <ul className="mt-3 divide-y divide-line">
                {undated.map((s) => (
                  <li key={s.id}>
                    <Link href={`/design/jobs/${encodeURIComponent(s.id)}`} className="group flex flex-wrap items-center gap-3 py-3">
                      <span className="min-w-0">
                        <span className="block truncate text-[15px] font-medium text-ink">{s.address || "Address to come"}</span>
                        <span className="block truncate text-xs text-muted">
                          {s.customer.name} · from {s.retailer}
                        </span>
                      </span>
                      <span className="ml-auto inline-flex items-center gap-1 text-sm font-medium text-ink">
                        Job card <ArrowRight className="size-4 transition group-hover:translate-x-0.5" aria-hidden />
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </div>
  );
}

/** One job: the roof with its panels on the left, what the crew needs on the right. */
function Sheet({ sheet: s }: { sheet: JobSheet }) {
  const picture = s.roof ? sheetRoofHref(s.id) : null;
  return (
    <article className={clsx(ui.card, "grid overflow-hidden lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]")}>
      <div className="bg-[#1f2937]">
        {s.layout ? (
          <svg
            viewBox={s.layout.viewBox}
            className="block h-full max-h-[420px] w-full"
            role="img"
            aria-label="The roof with its panel layout"
          >
            {picture && <image href={picture} x={0} y={0} width={ROOF_IMAGE.width} height={ROOF_IMAGE.height} />}
            {/* Made on the server from the design's numbers and fixed words only. */}
            <g dangerouslySetInnerHTML={{ __html: s.layout.marks }} />
          </svg>
        ) : picture ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={picture} alt="The roof from above" className="block h-full max-h-[420px] w-full object-cover" />
        ) : (
          <div className="flex h-full min-h-48 items-center justify-center p-6 text-center text-sm text-white/70">
            No roof design for this job yet.
          </div>
        )}
      </div>
      <div className="space-y-4 p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <p className="text-sm font-medium text-sun-line">{s.installDate ? longDay(s.installDate) : "Day to be confirmed"}</p>
          <Link href={`/design/jobs/${encodeURIComponent(s.id)}`} className={clsx(ui.quiet, "h-9")}>
            Job card <ArrowRight className="size-4" aria-hidden />
          </Link>
        </div>
        <dl className="space-y-2.5 text-sm">
          <Fact label="Retailer" icon={Store}>
            {s.retailer}
          </Fact>
          <Fact label="Job address" icon={MapPin}>
            <a href={mapLink(s.address)} target="_blank" rel="noreferrer" className="underline-offset-4 hover:underline">
              {s.address}
            </a>
          </Fact>
          <Fact label="Customer" icon={Phone}>
            {s.customer.name}
            {s.customer.phone && (
              <a href={`tel:${s.customer.phone.replace(/\s+/g, "")}`} className="ml-2 text-ink-2 underline-offset-4 hover:underline">
                {s.customer.phone}
              </a>
            )}
          </Fact>
        </dl>

        <div className="border-t border-line pt-4">
          <p className={ui.eyebrow}>System</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {s.solarKw !== null && <Chip icon={Sun} words={`${s.solarKw} kW solar`} />}
            {s.batteryKwh !== null && <Chip icon={BatteryFull} words={`${s.batteryKwh} kWh battery`} />}
            {s.ev && <Chip icon={PlugZap} words="EV charger" />}
          </div>
          {s.kit.length > 0 ? (
            <ul className="mt-3 space-y-1.5 text-sm">
              {s.kit.map((k) => (
                <li key={`${k.kind}-${k.model}`} className="flex gap-2">
                  <span className="w-16 shrink-0 text-muted">{KIT_WORDS[k.kind]}</span>
                  <span className="text-ink">
                    <span className="tabular-nums font-medium">{k.qty} ×</span> {k.model}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-sm text-ink-2">The products aren&apos;t on the job yet: check the job card.</p>
          )}
          <p className="mt-3 flex items-center gap-2 text-sm text-ink">
            <Home className="size-4 text-muted" aria-hidden />
            {[s.storeys, s.roofProfile && `${s.roofProfile} roof`].filter(Boolean).join(" · ") || "Roof and storeys to confirm"}
          </p>
        </div>

        <div className="border-t border-line pt-4">
          <p className={ui.eyebrow}>Equipment collection</p>
          {s.collection.length ? (
            <ul className="mt-2 space-y-3 text-sm">
              {s.collection.map((c) => (
                <li key={c.wholesaler} className="flex gap-2.5">
                  <Package className="mt-0.5 size-4 shrink-0 text-muted" aria-hidden />
                  <span className="min-w-0">
                    <span className="block font-medium text-ink">{c.wholesaler}</span>
                    <span className="block text-ink-2">
                      Order number: <span className="tabular-nums text-ink">{c.order || "not given yet"}</span>
                    </span>
                    {c.address ? (
                      <a
                        href={mapLink(c.address)}
                        target="_blank"
                        rel="noreferrer"
                        className="block text-ink-2 underline-offset-4 hover:underline"
                      >
                        {c.address}
                      </a>
                    ) : (
                      <span className="block text-muted">Collection address not given</span>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-sm text-ink-2">
              No order on this job yet. The retailer&apos;s wholesaler and order number show here once it is placed.
            </p>
          )}
        </div>
      </div>
    </article>
  );
}

function Fact({ label, icon: Icon, children }: { label: string; icon: typeof Sun; children: React.ReactNode }) {
  return (
    <div className="flex gap-2.5">
      <Icon className="mt-0.5 size-4 shrink-0 text-muted" aria-hidden />
      <dt className="w-24 shrink-0 text-muted">{label}</dt>
      <dd className="min-w-0 text-ink">{children}</dd>
    </div>
  );
}

function Chip({ icon: Icon, words }: { icon: typeof Sun; words: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-surface-2 px-3 py-1 text-sm font-medium text-ink">
      <Icon className="size-4 text-sun-line" aria-hidden /> {words}
    </span>
  );
}
