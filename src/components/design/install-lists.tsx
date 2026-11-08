"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { BatteryCharging, Check, Plug, Sun } from "lucide-react";
import clsx from "clsx";
import { INSTALLED_STAGES, PROGRESS, PROGRESS_LABELS, type ProgressKey } from "@/lib/domain/design/crm";
import {
  AFTER_INSTALL_STEPS,
  AFTER_STEP_WORDS,
  afterStepDone,
  completedInstalls,
  daysUntil,
  inTheWorks,
  installOrder,
  installRevenueThisMonth,
  installedOn,
  installerBooked,
  nextAfterStep,
  power,
  upcomingInstalls,
  type AfterInstallStep,
  type JobExtra,
} from "@/lib/domain/design/deal";
import { todayInMarket } from "@/lib/domain/market";
import type { ISODate } from "@/lib/domain/types";
import { loadInstallExtras } from "@/lib/services/after-sale";
import { dollars, listJobs, saveJob, shortDate, type JobLine } from "@/lib/services/crm";
import { PATHS, PageHead, ui } from "./design-shell";
import { Tally } from "./gauges";
import { installPanel, paperworkPanel, type PanelState } from "@/lib/domain/design/gauges";

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
function Banner({
  items,
}: {
  items: { label: string; value: string; under: string; signal?: boolean; tally?: { states: PanelState[] | null; label: string } }[];
}) {
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
          {/* One panel a job: lit when it's done, half-lit when partly. */}
          {item.tally && (
            <div className="mt-3">
              <Tally states={item.tally.states} tone="dark" label={item.tally.label} />
            </div>
          )}
        </div>
      ))}
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

/** How many of a job's four steps after the install are done. */
const stepsDone = (j: JobLine) => AFTER_INSTALL_STEPS.filter((s) => afterStepDone(j, s)).length;
const STEPS_TALLY = "Each install: lit when all four steps are done, half-lit when some are";

/** When a sold job is due: To book, Today, its day, or its day passed and not marked installed yet. */
function DueCell({ job, today, onJob }: { job: JobLine; today: ISODate; onJob: ListProps["onJob"] }) {
  const [busy, setBusy] = useState(false);
  if (!job.installDate) return <td className={clsx(cell, "text-[12.5px] font-medium text-sun-ink")}>To book</td>;
  const come = job.installDate <= today;
  const markInstalled = async () => {
    setBusy(true);
    const res = await saveJob(job.id, { stage: "installed" });
    setBusy(false);
    if (res.ok) onJob({ ...job, ...res.job });
  };
  return (
    <td className={clsx(cell, "text-[12.5px] tabular-nums")}>
      <span className={come ? "font-medium text-ink" : "text-ink-2"}>
        {job.installDate === today ? "Today" : shortDate(job.installDate)}
      </span>
      {come && (
        <button
          type="button"
          disabled={busy}
          onClick={() => void markInstalled()}
          className="ml-2 rounded-full bg-primary px-2.5 py-0.5 text-[11.5px] font-medium text-primary-ink hover:opacity-90 disabled:bg-surface-2 disabled:text-muted"
          title="Moves it to After install"
        >
          {busy ? "Marking…" : "Mark installed"}
        </button>
      )}
    </td>
  );
}

/**
 * The Installations list (8 Nov 2026, Martin: Upcoming and In the works were the calendar as a list): every sold job not
 * yet marked installed, booked ones soonest first (so one whose day has come leads, with Mark installed), then those
 * still to book. Marking one installed moves it to After install.
 */
export function UpcomingInstallsView({ jobs, today, onJob }: ListProps) {
  const extras = useExtras();
  const u = jobs ? upcomingInstalls(jobs, today) : null;
  const order = jobs ? installOrder(inTheWorks(jobs)) : null;
  const list = order ? [...order.booked, ...order.toBook] : null;
  return (
    <>
      <Banner
        items={[
          {
            label: "Awaiting install",
            value: list ? String(list.length) : "–",
            under: u ? `${dollars(u.value)} · ${power(u.kw)} sold` : "",
            tally: {
              states: list
                ? list.map((j) => installPanel(installerBooked(j), Boolean(extras?.find((e) => e.jobId === j.id)?.ordered)))
                : null,
              label: "Each install: lit when its installer is booked and materials ordered, half-lit when one is",
            },
          },
          { label: "Need an installation date", value: u ? String(u.toBook) : "–", under: "Sold, no date booked yet" },
          {
            label: "Install revenue MTD",
            value: jobs && extras ? dollars(installRevenueThisMonth(jobs, extras, today)) : "–",
            under: `Still payable on contracts installing in ${monthName(today)}`,
            signal: true,
          },
        ]}
      />
      <div className={clsx(ui.card, "mt-6 overflow-x-auto")}>
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
                  <DueCell job={j} today={today} onJob={onJob} />
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
    </>
  );
}

const STEP_FIELD: Record<AfterInstallStep, ProgressKey> = {
  invoice: "customerInvoice",
  coes: "coes",
  stcs: "stcClaim",
  grid: "gridConnection",
};

/** One of a job's four steps, as a dropdown: green when done, ringed in the signal colour when it's the next one. */
function StepSelect({ job, step, next, onJob }: { job: JobLine; step: AfterInstallStep; next: boolean; onJob: ListProps["onJob"] }) {
  const field = STEP_FIELD[step];
  const value = job.details?.[field] ?? (step === "coes" && afterStepDone(job, "coes") ? "received" : "");
  const done = afterStepDone(job, step);
  const labels = PROGRESS_LABELS[field] as Record<string, string>;
  return (
    <select
      value={value}
      onChange={(e) => void setDetail(job, field, e.target.value, onJob)}
      aria-label={`${AFTER_STEP_WORDS[step].title} for ${job.customerName}`}
      className={clsx(
        "rounded border px-1.5 py-1 text-[12.5px]",
        done
          ? "border-positive/40 bg-positive-soft text-positive"
          : next
            ? "border-sun-line bg-surface font-medium text-ink ring-1 ring-sun-line"
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

type StepFilter = AfterInstallStep | "open" | "done";

/**
 * After install (8 Nov 2026, Martin: the one view worth its own page, to make sure every installed job is invoiced, its
 * CoES followed up, its STCs claimed and its grid connection raised, in that order). The four steps across the top, each
 * with how many jobs are at it; pressing one shows those jobs. Every row has the four steps as dropdowns, the next one
 * ringed.
 */
export function CompletedInstallsView({ jobs, today, onJob }: ListProps) {
  const extras = useExtras();
  const [filter, setFilter] = useState<StepFilter>("open");
  const c = jobs ? completedInstalls(jobs, today) : null;
  const installed = jobs
    ? jobs.filter((j) => INSTALLED_STAGES.includes(j.stage)).sort((a, b) => (installedOn(a) ?? "").localeCompare(installedOn(b) ?? ""))
    : null;
  const atStep = (s: AfterInstallStep) => installed?.filter((j) => nextAfterStep(j) === s) ?? [];
  const open = installed?.filter((j) => nextAfterStep(j)) ?? null;
  const done = installed?.filter((j) => !nextAfterStep(j)).reverse() ?? null;
  const shown = filter === "open" ? open : filter === "done" ? done : installed ? atStep(filter) : null;
  const tab = (on: boolean) =>
    clsx(
      "flex min-w-[8.5rem] flex-1 flex-col rounded-lg px-4 py-3 text-left ring-1 transition",
      on ? "bg-surface ring-ink" : "bg-surface/60 ring-line hover:ring-ink-2",
    );
  return (
    <>
      <div className="mt-6 flex flex-wrap gap-2" role="tablist" aria-label="Steps after the install">
        {AFTER_INSTALL_STEPS.map((s, i) => {
          const n = installed ? atStep(s).length : null;
          return (
            <button
              key={s}
              type="button"
              role="tab"
              aria-selected={filter === s}
              onClick={() => setFilter(filter === s ? "open" : s)}
              className={tab(filter === s)}
            >
              <span className="text-[11px] tabular-nums text-muted">{i + 1}</span>
              <span className="text-[13px] font-medium text-ink">{AFTER_STEP_WORDS[s].doing}</span>
              <span className={clsx("mt-1 text-[22px] font-medium leading-none tabular-nums", n ? "text-sun-line" : "text-muted")}>
                {n ?? "–"}
              </span>
            </button>
          );
        })}
        <button
          type="button"
          role="tab"
          aria-selected={filter === "done"}
          onClick={() => setFilter(filter === "done" ? "open" : "done")}
          className={tab(filter === "done")}
        >
          <span className="text-[11px] text-muted">
            <Check className="inline size-3" aria-hidden />
          </span>
          <span className="text-[13px] font-medium text-ink">All done</span>
          <span className="mt-1 text-[22px] font-medium leading-none tabular-nums text-positive">{done ? done.length : "–"}</span>
        </button>
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <p className="text-[13px] text-ink-2">
          {filter === "open"
            ? "Every installed job with a step still to do, the longest installed first."
            : filter === "done"
              ? "Paid, CoES in, STCs claimed and grid connection raised."
              : `${AFTER_STEP_WORDS[filter].doing}: the jobs where it's the next step.`}
        </p>
        {c && installed && (
          <div className="flex items-center gap-3 text-[12px] text-muted">
            <span>
              {c.yearCount} installed {c.yearLabel} · {dollars(c.yearValue)}
            </span>
            <Tally states={installed.map((j) => paperworkPanel(stepsDone(j) === 4 ? 3 : Math.min(2, stepsDone(j))))} label={STEPS_TALLY} />
          </div>
        )}
      </div>
      <div className={clsx(ui.card, "mt-3 overflow-x-auto")}>
        <table className="w-full min-w-[56rem]">
          <thead>
            <tr className="border-b border-line">
              <th className={clsx(head, "pl-4")}>Job</th>
              <th className={head}>System</th>
              <th className={head}>Installed</th>
              {AFTER_INSTALL_STEPS.map((s, i) => (
                <th key={s} className={clsx(head, i === 3 && "pr-4")}>
                  {i + 1}. {AFTER_STEP_WORDS[s].title}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {!shown && (
              <tr>
                <td colSpan={7} className="p-4 text-[13px] text-muted">
                  Loading…
                </td>
              </tr>
            )}
            {shown?.length === 0 && (
              <tr>
                <td colSpan={7} className="p-4 text-[13px] text-ink-2">
                  {installed?.length === 0 ? "Nothing installed yet." : filter === "done" ? "None finished yet." : "Nothing waiting here."}
                </td>
              </tr>
            )}
            {shown?.map((j) => {
              const next = nextAfterStep(j);
              const on = installedOn(j);
              return (
                <tr key={j.id}>
                  <JobCell job={j} />
                  <td className={cell}>
                    <SystemMarks job={j} extra={extras?.find((e) => e.jobId === j.id)} />
                  </td>
                  <td className={clsx(cell, "text-[12.5px] tabular-nums text-ink-2")}>
                    {on ? shortDate(on) : "–"}
                    {on && next && daysUntil(on, today) < 0 && (
                      <span className="block text-[11px] text-muted">{-daysUntil(on, today)} days ago</span>
                    )}
                  </td>
                  {AFTER_INSTALL_STEPS.map((s, i) => (
                    <td key={s} className={clsx(cell, i === 3 && "pr-4")}>
                      <StepSelect job={j} step={s} next={next === s} onJob={onJob} />
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}

/** Calendar or List, the way the Installations page shows its jobs. */
export type InstallView = "calendar" | "list";

/** The switch between the two, kept in the address so a reload or a link keeps it. */
export function InstallViewSwitch({ view, onView }: { view: InstallView; onView: (v: InstallView) => void }) {
  return (
    <div className="flex rounded-md border border-line p-0.5" role="radiogroup" aria-label="Show installations as">
      {(["calendar", "list"] as const).map((v) => (
        <button
          key={v}
          type="button"
          role="radio"
          aria-checked={view === v}
          onClick={() => onView(v)}
          className={clsx("h-8 rounded px-3 text-sm capitalize", view === v ? "bg-primary text-primary-ink" : "text-ink-2 hover:text-ink")}
        >
          {v}
        </button>
      ))}
    </div>
  );
}

/** The business's jobs, loaded once, with a way to put back one that changed. */
function useJobs() {
  const [jobs, setJobs] = useState<JobLine[] | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
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
  return { jobs, problem, changed };
}

const Problem = ({ text }: { text: string | null }) =>
  text && (
    <p className="mt-6 rounded-md bg-warning-soft px-4 py-3 text-sm text-warning" role="alert">
      {text}
    </p>
  );

/** The Installations page as a list: every sold job not yet installed. */
export function InstallListPage({ switcher }: { switcher: React.ReactNode }) {
  const { jobs, problem, changed } = useJobs();
  return (
    <div className={ui.page}>
      <PageHead title="Installations">{switcher}</PageHead>
      <Problem text={problem} />
      <UpcomingInstallsView jobs={jobs} today={todayInMarket()} onJob={changed} />
    </div>
  );
}

/** /design/installations/completed: After install. */
export function AfterInstallPage() {
  const { jobs, problem, changed } = useJobs();
  return (
    <div className={ui.page}>
      <PageHead title="After install" />
      <p className="mt-1 text-[13.5px] text-ink-2">
        Every installed job, taken through four steps in order: invoice, CoES, STCs, grid connection.
      </p>
      <Problem text={problem} />
      <CompletedInstallsView jobs={jobs} today={todayInMarket()} onJob={changed} />
    </div>
  );
}
