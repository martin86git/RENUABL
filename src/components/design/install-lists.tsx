"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, BatteryCharging, Check, Plug, Sun } from "lucide-react";
import clsx from "clsx";
import { INSTALLED_STAGES, PROGRESS, PROGRESS_LABELS, type ProgressKey } from "@/lib/domain/design/crm";
import {
  completedInstalls,
  inTheWorks,
  installOrder,
  installPhase,
  installRevenueThisMonth,
  installedOn,
  installerBooked,
  paperworkDone,
  power,
  upcomingInstalls,
  weekOf,
  type InstallPhase,
  type JobExtra,
} from "@/lib/domain/design/deal";
import { todayInMarket } from "@/lib/domain/market";
import type { ISODate } from "@/lib/domain/types";
import { loadInstallExtras } from "@/lib/services/after-sale";
import { dollars, listJobs, saveJob, shortDate, type JobLine } from "@/lib/services/crm";
import { PATHS, PageHead, ui } from "./design-shell";

type ListProps = { jobs: JobLine[] | null; today: ISODate; onJob: (job: JobLine) => void };

const monthName = (today: ISODate) => new Date(`${today}T00:00:00Z`).toLocaleDateString("en-AU", { month: "long", timeZone: "UTC" });

/** Each signed job's battery, what is payable, the deposit received and whether its parts are ordered. */
function useExtras() {
  const [extras, setExtras] = useState<JobExtra[] | null>(null);
  useEffect(() => {
    let gone = false;
    void loadInstallExtras().then((res) => !gone && setExtras(res.ok ? res.extras : []));
    return () => {
      gone = true;
    };
  }, []);
  return extras;
}

/** The black banner: a view's few headline figures, side by side. */
function Banner({ items }: { items: { label: string; value: string; under: string; signal?: boolean }[] }) {
  return (
    <section
      className={clsx("mt-6 grid overflow-hidden rounded-lg bg-ink text-white", items.length === 3 ? "sm:grid-cols-3" : "sm:grid-cols-2")}
    >
      {items.map((item, i) => (
        <div key={item.label} className={clsx("px-5 py-4", i > 0 && "border-t border-white/15 sm:border-l sm:border-t-0")}>
          <p className="text-[10.5px] font-medium uppercase tracking-[0.16em] text-white/60">{item.label}</p>
          <p className={clsx("mt-2 text-[26px] font-medium leading-none tabular-nums tracking-tight", item.signal && "text-sun-line")}>
            {item.value}
          </p>
          <p className="mt-2 text-[11.5px] text-white/60">{item.under}</p>
        </div>
      ))}
    </section>
  );
}

/** This week, Monday to Sunday, each day with the jobs on it. */
function WeekCalendar({
  title,
  jobs,
  today,
  dayOf,
}: {
  title: string;
  jobs: JobLine[] | null;
  today: ISODate;
  dayOf: (j: JobLine) => ISODate | null;
}) {
  return (
    <section className="mt-6" aria-label={title}>
      <h2 className="text-[15px] font-medium tracking-tight text-ink">{title}</h2>
      <ol className={clsx(ui.card, "mt-2.5 grid grid-cols-1 divide-y divide-line sm:grid-cols-7 sm:divide-x sm:divide-y-0")}>
        {weekOf(today).map((date) => {
          const on = (jobs ?? []).filter((j) => dayOf(j) === date);
          const day = new Date(`${date}T00:00:00Z`);
          return (
            <li key={date} className={clsx("flex min-h-24 flex-col p-2.5", date === today && "bg-sun")}>
              <p className="flex items-baseline gap-1.5">
                <span
                  className={clsx("text-[10.5px] font-medium uppercase tracking-[0.14em]", date === today ? "text-sun-ink" : "text-muted")}
                >
                  {day.toLocaleDateString("en-AU", { weekday: "short", timeZone: "UTC" })}
                </span>
                <span className="text-[13px] font-medium tabular-nums text-ink">{day.getUTCDate()}</span>
              </p>
              <ul className="mt-1.5 space-y-1">
                {on.map((j) => (
                  <li key={j.id}>
                    <Link
                      href={`${PATHS.deals}/${j.id}`}
                      className="block rounded px-1.5 py-1 text-[11.5px] leading-snug ring-1 ring-line hover:ring-ink-2"
                    >
                      <span className="block truncate font-medium text-ink">{j.customerName}</span>
                      <span className="block truncate text-muted">{j.kw ? power(j.kw) : (j.address || "").split(",")[0]}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

/** What a job's system is, as three marks (solar, battery, EV charger, each lit when it has one) and the sizes. */
function SystemMarks({ job, extra }: { job: JobLine; extra?: JobExtra }) {
  const battery = extra?.batteryKwh ?? 0;
  const ev = job.details?.evCharger ?? "";
  const mark = (on: boolean) => clsx("size-4", on ? "text-sun-line" : "text-line-strong");
  const sizes = [job.kw ? power(job.kw) : null, battery > 0 ? `${battery} kWh` : null, ev ? `EV ${ev}` : null].filter(Boolean);
  return (
    <span className="flex items-center gap-2">
      <span className="flex gap-1" aria-hidden>
        <Sun className={mark(Boolean(job.kw))} />
        <BatteryCharging className={mark(battery > 0)} />
        <Plug className={mark(Boolean(ev))} />
      </span>
      <span className="text-[12.5px] tabular-nums text-ink-2">{sizes.length ? sizes.join(" · ") : "–"}</span>
    </span>
  );
}

/** Saves one of a job's progress details, sending the rest as they are. */
async function setDetail(job: JobLine, key: string, value: string, onJob: ListProps["onJob"]) {
  const details = { ...job.details };
  if (value) details[key] = value;
  else delete details[key];
  onJob({ ...job, details });
  const res = await saveJob(job.id, { details });
  if (res.ok) onJob({ ...job, ...res.job });
}

const cell = "px-3 py-2.5 align-middle";
const head = "px-3 py-2 text-left text-[10.5px] font-medium uppercase tracking-[0.12em] text-muted";

function JobCell({ job }: { job: JobLine }) {
  return (
    <td className={clsx(cell, "pl-4")}>
      <Link href={`${PATHS.deals}/${job.id}`} className="block max-w-[16rem] truncate text-[13px] font-medium text-ink hover:underline">
        {(job.address || job.title).split(",")[0]}
      </Link>
      <span className="block max-w-[16rem] truncate text-[11.5px] text-muted">{job.customerName}</span>
    </td>
  );
}

/** Upcoming installs: what is awaiting install, how many need a date, this month's install revenue, this week, and every job. */
export function UpcomingInstallsView({ jobs, today, onJob }: ListProps) {
  const extras = useExtras();
  const u = jobs ? upcomingInstalls(jobs, today) : null;
  const order = jobs ? installOrder(inTheWorks(jobs)) : null;
  const list = order ? [...order.booked, ...order.toBook] : null;
  return (
    <>
      <Banner
        items={[
          { label: "Awaiting install", value: u ? String(u.total) : "–", under: u ? `${dollars(u.value)} · ${power(u.kw)} sold` : "" },
          { label: "Need an installation date", value: u ? String(u.toBook) : "–", under: "Sold, no date booked yet" },
          {
            label: "Install revenue MTD",
            value: jobs && extras ? dollars(installRevenueThisMonth(jobs, extras, today)) : "–",
            under: `Still payable on contracts installing in ${monthName(today)}`,
            signal: true,
          },
        ]}
      />
      <WeekCalendar title="Installs this week" jobs={list} today={today} dayOf={(j) => j.installDate} />
      <section className="mt-6" aria-label="Awaiting install">
        <div className="flex items-baseline justify-between">
          <h2 className="text-[15px] font-medium tracking-tight text-ink">Awaiting install</h2>
          <Link href={PATHS.scheduler} className={clsx(ui.link, "text-[12.5px]")}>
            Install Scheduler <ArrowRight className="inline size-3.5" aria-hidden />
          </Link>
        </div>
        <div className={clsx(ui.card, "mt-2.5 overflow-x-auto")}>
          <table className="w-full min-w-[46rem]">
            <thead>
              <tr className="border-b border-line">
                <th className={clsx(head, "pl-4")}>Job</th>
                <th className={head}>System</th>
                <th className={head}>Install date</th>
                <th className={head}>Installer booked</th>
                <th className={clsx(head, "pr-4")}>Materials ordered</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {!list && (
                <tr>
                  <td colSpan={5} className="p-4 text-[13px] text-muted">
                    Loading…
                  </td>
                </tr>
              )}
              {list?.length === 0 && (
                <tr>
                  <td colSpan={5} className="p-4 text-[13px] text-ink-2">
                    Nothing sold is waiting to be installed.
                  </td>
                </tr>
              )}
              {list?.map((j) => {
                const extra = extras?.find((e) => e.jobId === j.id);
                const booked = installerBooked(j);
                return (
                  <tr key={j.id}>
                    <JobCell job={j} />
                    <td className={cell}>
                      <SystemMarks job={j} extra={extra} />
                    </td>
                    <td className={clsx(cell, "text-[12.5px] tabular-nums", j.installDate ? "text-ink-2" : "font-medium text-sun-ink")}>
                      {j.installDate ? shortDate(j.installDate) : "To book"}
                    </td>
                    <td className={cell}>
                      <span className="flex items-center gap-1.5">
                        {booked && <Check className="size-4 shrink-0 text-positive" aria-label="Booked" />}
                        <input
                          defaultValue={j.details?.installer ?? ""}
                          placeholder="Who's installing"
                          aria-label={`Installer for ${j.customerName}`}
                          onBlur={(e) =>
                            e.target.value.trim() !== (j.details?.installer ?? "") &&
                            void setDetail(j, "installer", e.target.value.trim(), onJob)
                          }
                          className="w-40 rounded border border-transparent bg-transparent px-1.5 py-1 text-[12.5px] text-ink hover:border-line focus:border-forest focus:outline-none"
                        />
                      </span>
                    </td>
                    <td className={clsx(cell, "pr-4")}>
                      {extra?.ordered ? (
                        <span className="inline-flex items-center gap-1 text-[12.5px] text-positive">
                          <Check className="size-4" aria-hidden /> Ordered
                        </span>
                      ) : extra ? (
                        <Link
                          href={`${PATHS.orders}/${j.id}`}
                          className="text-[12.5px] font-medium text-sun-ink underline underline-offset-4"
                        >
                          To order
                        </Link>
                      ) : (
                        <span className="text-[12.5px] text-muted">No signed proposal</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}

const FIELD_NAMES: Record<ProgressKey, string> = {
  customerInvoice: "Customer invoice",
  stcClaim: "STCs",
  gridConnection: "Grid connection",
};

/** One of a completed job's progress choices, as a dropdown in its row. */
function ProgressSelect({ job, field, onJob }: { job: JobLine; field: ProgressKey; onJob: ListProps["onJob"] }) {
  const value = job.details?.[field] ?? "";
  const done = value === "paid" || value === "claimed" || value === "completed";
  const labels = PROGRESS_LABELS[field] as Record<string, string>;
  return (
    <select
      value={value}
      onChange={(e) => void setDetail(job, field, e.target.value, onJob)}
      aria-label={`${FIELD_NAMES[field]} for ${job.customerName}`}
      className={clsx(
        "rounded border px-1.5 py-1 text-[12.5px]",
        done
          ? "border-positive/40 bg-positive-soft text-positive"
          : value
            ? "border-line bg-surface text-ink"
            : "border-line bg-surface text-muted",
      )}
    >
      <option value="">–</option>
      {(PROGRESS[field] as readonly string[]).map((v) => (
        <option key={v} value={v}>
          {labels[v]}
        </option>
      ))}
    </select>
  );
}

/**
 * Completed installs: this financial year's, the paperwork still open, unpaid invoices, this week, and every job. With a
 * phase, only the jobs in it (`installPhase`): in the works (the day has come, the paperwork isn't done) or completed.
 */
export function CompletedInstallsView({ jobs, today, onJob, phase }: ListProps & { phase?: Exclude<InstallPhase, "upcoming"> }) {
  const extras = useExtras();
  const c = jobs ? completedInstalls(jobs, today) : null;
  const done = jobs
    ? jobs
        .filter((j) => (phase ? installPhase(j, today) === phase : INSTALLED_STAGES.includes(j.stage)))
        .sort((a, b) => (installedOn(b) ?? "").localeCompare(installedOn(a) ?? ""))
    : null;
  const open = done?.filter((j) => !paperworkDone(j)) ?? null;
  const unpaid = done?.filter((j) => j.details?.customerInvoice !== "paid") ?? null;
  const works = phase === "in-works";
  const title = works ? "In the works" : "Completed installs";
  return (
    <>
      <Banner
        items={
          works
            ? [
                { label: "In the works", value: done ? String(done.length) : "–", under: "Installed or due, paperwork still to finish" },
                {
                  label: "STCs not claimed",
                  value: done ? String(done.filter((j) => j.details?.stcClaim !== "claimed").length) : "–",
                  under: "",
                },
                {
                  label: "Invoices not paid",
                  value: unpaid ? String(unpaid.length) : "–",
                  under:
                    unpaid && extras
                      ? `${dollars(unpaid.reduce((n, j) => n + Math.max(0, (extras.find((e) => e.jobId === j.id)?.youPay ?? j.value ?? 0) - (extras.find((e) => e.jobId === j.id)?.depositReceived ?? 0)), 0))} still to come in`
                      : "",
                  signal: true,
                },
              ]
            : [
                {
                  label: `Completed installs · ${c?.yearLabel ?? "financial year"}`,
                  value: c ? String(c.yearCount) : "–",
                  under: c ? `${dollars(c.yearValue)} · ${power(c.yearKw)} since 1 July` : "",
                },
                {
                  label: "Paperwork open",
                  value: open ? String(open.length) : "–",
                  under: "Invoice, STCs or grid connection still to finish",
                },
                {
                  label: "Invoices not paid",
                  value: unpaid ? String(unpaid.length) : "–",
                  under:
                    unpaid && extras
                      ? `${dollars(unpaid.reduce((n, j) => n + Math.max(0, (extras.find((e) => e.jobId === j.id)?.youPay ?? j.value ?? 0) - (extras.find((e) => e.jobId === j.id)?.depositReceived ?? 0)), 0))} still to come in`
                      : "",
                  signal: true,
                },
              ]
        }
      />
      <WeekCalendar title={works ? "Installing this week" : "Completed this week"} jobs={done} today={today} dayOf={installedOn} />
      <section className="mt-6" aria-label={title}>
        <h2 className="text-[15px] font-medium tracking-tight text-ink">{title}</h2>
        <div className={clsx(ui.card, "mt-2.5 overflow-x-auto")}>
          <table className="w-full min-w-[50rem]">
            <thead>
              <tr className="border-b border-line">
                <th className={clsx(head, "pl-4")}>Job</th>
                <th className={head}>System</th>
                <th className={head}>Installed</th>
                <th className={head}>Customer invoice</th>
                <th className={head}>STCs</th>
                <th className={clsx(head, "pr-4")}>Grid connection</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {!done && (
                <tr>
                  <td colSpan={6} className="p-4 text-[13px] text-muted">
                    Loading…
                  </td>
                </tr>
              )}
              {done?.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-4 text-[13px] text-ink-2">
                    {works ? "Nothing in the works." : "Nothing installed yet."}
                  </td>
                </tr>
              )}
              {done?.map((j) => (
                <tr key={j.id}>
                  <JobCell job={j} />
                  <td className={cell}>
                    <SystemMarks job={j} extra={extras?.find((e) => e.jobId === j.id)} />
                  </td>
                  <td className={clsx(cell, "text-[12.5px] tabular-nums text-ink-2")}>
                    {installedOn(j) ? shortDate(installedOn(j)!) : "–"}
                  </td>
                  <td className={cell}>
                    <ProgressSelect job={j} field="customerInvoice" onJob={onJob} />
                  </td>
                  <td className={cell}>
                    <ProgressSelect job={j} field="stcClaim" onJob={onJob} />
                  </td>
                  <td className={clsx(cell, "pr-4")}>
                    <ProgressSelect job={j} field="gridConnection" onJob={onJob} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}

const PHASE_HEAD: Record<InstallPhase, string> = {
  upcoming: "Upcoming installations.",
  "in-works": "Installations in the works.",
  completed: "Completed installations.",
};

/** An Installations page: the business's jobs in one phase (`installPhase`), as the overview's lists show them. */
export function InstallationsPhasePage({ phase }: { phase: InstallPhase }) {
  const [jobs, setJobs] = useState<JobLine[] | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const today = todayInMarket();
  useEffect(() => {
    let gone = false;
    void listJobs().then((res) => {
      if (gone) return;
      if (res.ok) setJobs(res.jobs);
      else setProblem(res.message);
    });
    return () => {
      gone = true;
    };
  }, []);
  const changed = (job: JobLine) => setJobs((all) => (all ?? []).map((j) => (j.id === job.id ? job : j)));
  return (
    <div className={ui.page}>
      <PageHead eyebrow="Installations" title={PHASE_HEAD[phase]} />
      {problem && (
        <p className="mt-6 rounded-md bg-warning-soft px-4 py-3 text-sm text-warning" role="alert">
          {problem}
        </p>
      )}
      {phase === "upcoming" ? (
        <UpcomingInstallsView jobs={jobs && jobs.filter((j) => installPhase(j, today) === "upcoming")} today={today} onJob={changed} />
      ) : (
        <CompletedInstallsView jobs={jobs} today={today} onJob={changed} phase={phase} />
      )}
    </div>
  );
}
