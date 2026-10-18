"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, PenTool, UserPlus } from "lucide-react";
import clsx from "clsx";
import { STAGE_LABELS, WON_STAGES, type JobStage } from "@/lib/domain/design/crm";
import { PIPELINES, dashboard, power, weekOf } from "@/lib/domain/design/deal";
import { todayInMarket } from "@/lib/domain/market";
import { dollars, listJobs, loadOverview, shortDate, type JobLine, type Overview } from "@/lib/services/crm";
import { useDesignAccount } from "./design-account";
import { CHAPTERS, CLOSE } from "@/lib/domain/design/landing";
import { AfterSigningDemo, AutomationDemo, ConversationDemo } from "./designer-showcase";
import { DesignShell, PATHS, PageHead, ui } from "./design-shell";
import { FrontHero, Reveal } from "./front-hero";
import { SignInForm } from "./sign-in-form";

/** A stage as a small tag. Won and installed are the good news; lost is quiet. */
export function StageTag({ stage }: { stage: JobStage }) {
  return (
    <span
      className={clsx(
        "inline-flex h-6 items-center whitespace-nowrap rounded px-2 text-[11px] font-medium uppercase tracking-[0.08em]",
        WON_STAGES.includes(stage)
          ? "bg-positive-soft text-positive"
          : stage === "lost"
            ? "bg-surface-2 text-muted"
            : stage === "proposal"
              ? "bg-sun text-sun-ink"
              : "bg-surface-2 text-ink-2",
      )}
    >
      {STAGE_LABELS[stage]}
    </span>
  );
}

/** What someone did, in a word. */
export const ACTIVITY_WORD = {
  note: "Note",
  call: "Call",
  email: "Email",
  stage: "Stage",
  proposal: "Proposal",
  message: "Message",
  order: "Order",
  invoice: "Invoice",
  reminder: "Reminder",
} as const;

/**
 * /design. Signed out, the product's front page: what it is, and the way in
 * (a one-time link by email, the same whether it is someone's first time or
 * not). Signed in, the business's overview inside the app's frame.
 */
export function DesignHome() {
  const [account] = useDesignAccount();
  if (!account) return <div className="theme-studio min-h-dvh" aria-busy="true" />;
  if (account.signedIn)
    return (
      <DesignShell needsAccount>
        <OverviewPage business={account.business?.name ?? ""} />
      </DesignShell>
    );
  return <FrontPage unreachable={Boolean(account.unreachable)} />;
}

function FrontPage({ unreachable }: { unreachable: boolean }) {
  return (
    <div className="theme-studio flex min-h-dvh flex-col bg-canvas">
      <FrontHero signInHref="#sign-in" tryHref={PATHS.designer} />

      {/* A sentence a screen, each with the product doing it. */}
      {CHAPTERS.map((c, i) => (
        <section key={c.key} className="px-5 py-24 lg:px-10 lg:py-36" aria-labelledby={`chapter-${c.key}`}>
          <Reveal className="mx-auto w-full max-w-6xl">
            <p className="text-center text-[12px] font-medium tabular-nums tracking-[0.3em] text-muted">0{i + 1}</p>
            <h2
              id={`chapter-${c.key}`}
              className="mx-auto mt-5 max-w-4xl text-center text-[clamp(36px,6vw,76px)] font-light leading-[1.02] tracking-[-0.035em] text-ink"
            >
              {c.line}
            </h2>
            <p className="mx-auto mt-6 max-w-xl text-center text-[18px] leading-relaxed text-ink-2">{c.sub}</p>
          </Reveal>
          <Reveal className="mx-auto mt-16 w-full max-w-6xl">
            {c.key === "prices" ? <AutomationDemo /> : c.key === "proposal" ? <ConversationDemo /> : <AfterSigningDemo />}
          </Reveal>
        </section>
      ))}

      {/* The close, and the way in. */}
      <section id="sign-in" className="px-5 py-28 lg:px-10 lg:py-40" aria-labelledby="close">
        <Reveal className="mx-auto w-full max-w-3xl text-center">
          <h2 id="close" className="text-[clamp(56px,10vw,120px)] font-light leading-[0.9] tracking-[-0.045em] text-ink">
            {CLOSE.line}
          </h2>
          <p className="mt-6 text-[18px] text-ink-2">{CLOSE.sub}</p>
          <div className={clsx(ui.card, "mx-auto mt-12 max-w-sm p-6 text-left sm:p-7")}>
            <SignInForm next={PATHS.home} note={unreachable ? "We couldn't reach your account just now. Try again in a moment." : null} />
          </div>
        </Reveal>
      </section>
    </div>
  );
}

/** A change against an earlier period, as a small signed percentage: green up, red down, quiet when there is nothing to compare. */
function Delta({ value, against, dark }: { value: number | null; against: string; dark?: boolean }) {
  if (value === null) return <span className={clsx("text-xs", dark ? "text-white/45" : "text-muted")}>No sales {against} to compare</span>;
  return (
    <span className="inline-flex items-center gap-1.5 text-xs">
      <span
        className={clsx(
          "rounded px-1.5 py-0.5 font-medium tabular-nums",
          value > 0
            ? "bg-positive-soft text-positive"
            : value < 0
              ? "bg-warning-soft text-danger"
              : dark
                ? "bg-white/10 text-white"
                : "bg-surface-2 text-ink-2",
        )}
      >
        {value > 0 ? "+" : value < 0 ? "−" : ""}
        {Math.abs(value)}%
      </span>
      <span className={dark ? "text-white/60" : "text-muted"}>{against}</span>
    </span>
  );
}

/**
 * The business at a glance: what it has sold this financial year and this
 * month (against the same days last month and last year), new deals and how
 * many were sold, the kilowatts, installations booked and done, what is in
 * the grid connection stage and what is still open; then where its deals
 * stand in each pipeline, and what happened last. Every figure is worked out
 * from the deals as they stand (`dashboard` in `deal.ts`).
 */
function OverviewPage({ business }: { business: string }) {
  const [data, setData] = useState<Overview | null>(null);
  const [jobs, setJobs] = useState<JobLine[] | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  useEffect(() => {
    let gone = false;
    void loadOverview().then((res) => {
      if (gone) return;
      if (res.ok) setData(res);
      else setProblem(res.message);
    });
    void listJobs().then((res) => {
      if (!gone && res.ok) setJobs(res.jobs);
    });
    return () => {
      gone = true;
    };
  }, []);

  const today = todayInMarket();
  const d = jobs ? dashboard(jobs, today) : null;
  const monthName = new Date(`${today}T00:00:00Z`).toLocaleDateString("en-AU", { month: "long", timeZone: "UTC" });
  const show = (value: string | number | undefined) => (d && value !== undefined ? String(value) : "–");
  const tiles: [name: string, value: string, under: string][] = [
    ["New deals", show(d?.newDeals), `Leads started in ${monthName}`],
    [
      "Deals sold",
      show(d?.sold),
      d && d.conversion !== null
        ? `${Math.round(d.conversion * 100)}% of ${monthName}'s new deals`
        : `No new deals in ${monthName} to convert`,
    ],
    ["Solar sold", d ? power(d.kwMonth) : "–", d ? `${power(d.kwYear)} this financial year` : ""],
    ["Installs booked", show(d?.installsBooked), `With a date in ${monthName}, not yet done`],
    ["Installs completed", show(d?.installsDone), `Finished in ${monthName}`],
    ["In grid connection", show(d?.inGrid), "Deals at the grid connection stage"],
    ["Open pipeline", d ? dollars(d.openValue) : "–", d ? `${d.openDeals} ${d.openDeals === 1 ? "deal" : "deals"} still being sold` : ""],
    ["Customers", data ? String(data.customers) : "–", "Everyone in your list"],
  ];

  return (
    <div className={ui.page}>
      <PageHead eyebrow="Overview" title={business || "Your business"}>
        <Link href={`${PATHS.customers}?new=1`} className={ui.quiet}>
          <UserPlus className="size-4" aria-hidden /> New customer
        </Link>
        <Link href={PATHS.designer} className={ui.primary}>
          <PenTool className="size-4" aria-hidden /> Open the design tool
        </Link>
      </PageHead>

      {problem && (
        <p className="mt-6 rounded-md bg-warning-soft px-4 py-3 text-sm text-warning" role="alert">
          {problem}
        </p>
      )}

      {/* Sales, first and largest: the financial year, and the month so far with how it compares. */}
      <section className="mt-8 grid overflow-hidden rounded-lg bg-ink text-white sm:grid-cols-2" aria-label="Sales">
        <div className="p-6">
          <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-white/60">Sales · {d?.yearLabel ?? "financial year"}</p>
          <p className="mt-3 text-[40px] font-medium leading-none tabular-nums tracking-tight">{d ? dollars(d.salesYear) : "–"}</p>
          <p className="mt-3 text-xs text-white/60">
            {d ? `${d.soldYear} ${d.soldYear === 1 ? "deal" : "deals"} sold since 1 July, at their quoted prices` : ""}
          </p>
        </div>
        <div className="border-t border-white/15 p-6 sm:border-l sm:border-t-0">
          <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-white/60">Sales · {monthName} to date</p>
          <p className="mt-3 text-[40px] font-medium leading-none tabular-nums tracking-tight text-sun-line">
            {d ? dollars(d.salesMonth) : "–"}
          </p>
          <p className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">
            {d && (
              <>
                <Delta value={d.vsLastMonth} against="on the same days last month" dark />
                <Delta value={d.vsLastYear} against="on the same days last year" dark />
              </>
            )}
          </p>
        </div>
      </section>

      <section className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4" aria-label="This month">
        {tiles.map(([name, value, under]) => (
          <div key={name} className={clsx(ui.card, "p-5")}>
            <p className={ui.eyebrow}>{name}</p>
            <p className="mt-2 text-[28px] font-medium leading-none tabular-nums tracking-tight text-ink">{value}</p>
            <p className="mt-2 text-[12.5px] text-muted">{under}</p>
          </div>
        ))}
      </section>

      {/* This week's installations: Monday to Sunday, each day with what is booked on it. */}
      <section className="mt-8" aria-labelledby="week">
        <div className="flex items-baseline justify-between">
          <h2 id="week" className="text-[17px] tracking-tight text-ink">
            Installs this week
          </h2>
          <Link href={PATHS.installations} className={clsx(ui.link, "text-[13px]")}>
            All installations <ArrowRight className="inline size-3.5" aria-hidden />
          </Link>
        </div>
        <ol className={clsx(ui.card, "mt-3 grid grid-cols-1 divide-y divide-line sm:grid-cols-7 sm:divide-x sm:divide-y-0")}>
          {weekOf(today).map((date) => {
            const booked = (jobs ?? []).filter((j) => j.installDate === date && j.stage !== "lost");
            const day = new Date(`${date}T00:00:00Z`);
            return (
              <li key={date} className={clsx("flex min-h-32 flex-col p-3", date === today && "bg-sun")}>
                <p className="flex items-baseline justify-between gap-2 sm:block">
                  <span
                    className={clsx("text-[11px] font-medium uppercase tracking-[0.14em]", date === today ? "text-sun-ink" : "text-muted")}
                  >
                    {day.toLocaleDateString("en-AU", { weekday: "short", timeZone: "UTC" })}
                  </span>
                  <span className="block text-[20px] font-medium leading-tight tabular-nums text-ink sm:mt-0.5">
                    {day.toLocaleDateString("en-AU", { day: "numeric", timeZone: "UTC" })}
                    <span className="ml-1 text-xs font-normal text-muted">
                      {day.toLocaleDateString("en-AU", { month: "short", timeZone: "UTC" })}
                    </span>
                  </span>
                </p>
                <ul className="mt-2 space-y-1.5">
                  {booked.map((j) => (
                    <li key={j.id}>
                      <Link
                        href={`${PATHS.deals}/${j.id}`}
                        className={clsx(
                          "block rounded-md px-2 py-1.5 text-xs leading-snug ring-1 hover:ring-ink-2",
                          WON_STAGES.includes(j.stage) ? "bg-surface text-ink ring-line" : "bg-surface-2 text-ink-2 ring-line",
                        )}
                      >
                        <span className="block truncate font-medium">{j.customerName}</span>
                        <span className="block truncate text-muted">
                          {j.kw ? `${power(j.kw)} · ` : ""}
                          {j.address ? j.address.split(",")[0] : j.title}
                        </span>
                        <span className="block truncate text-[10px] uppercase tracking-[0.08em] text-muted">{STAGE_LABELS[j.stage]}</span>
                      </Link>
                    </li>
                  ))}
                  {jobs && booked.length === 0 && <li className="text-xs text-muted">–</li>}
                </ul>
              </li>
            );
          })}
        </ol>
      </section>

      <section className="mt-8" aria-labelledby="stages">
        <div className="flex items-baseline justify-between">
          <h2 id="stages" className="text-[17px] tracking-tight text-ink">
            Deals by pipeline
          </h2>
          <Link href={PATHS.sales} className={clsx(ui.link, "text-[13px]")}>
            Open pipelines <ArrowRight className="inline size-3.5" aria-hidden />
          </Link>
        </div>
        <div className="mt-3 space-y-3">
          {PIPELINES.slice(0, 3).map((p) => (
            <div key={p.id} className={clsx(ui.card, "p-4")}>
              <p className={ui.eyebrow}>{p.name}</p>
              <ol className="mt-3 flex flex-wrap gap-x-2 gap-y-3">
                {p.stages.map((stage, i) => (
                  <li key={stage} className="flex min-w-[7.5rem] flex-1 items-center gap-2">
                    <div className="min-w-0 flex-1 rounded-md bg-surface-2 px-3 py-2.5">
                      <p className="text-[22px] font-medium leading-none tabular-nums text-ink">{data ? (data.counts[stage] ?? 0) : "–"}</p>
                      <p className="mt-1.5 truncate text-xs text-ink-2">{STAGE_LABELS[stage]}</p>
                    </div>
                    {i < p.stages.length - 1 && <ArrowRight className="size-3.5 shrink-0 text-muted" aria-hidden />}
                  </li>
                ))}
              </ol>
            </div>
          ))}
        </div>
        <p className="mt-2 text-xs text-muted">
          Sales count from when a deal is moved to Won, at its quoted price. Kilowatts count for deals whose design has been saved since
          this was added.{data ? ` Lost: ${data.counts.lost ?? 0}.` : ""}
        </p>
      </section>

      <section className="mt-8" aria-labelledby="recent">
        <h2 id="recent" className="text-[17px] tracking-tight text-ink">
          Latest
        </h2>
        <div className={clsx(ui.card, "mt-3")}>
          {!data ? (
            <p className="p-5 text-sm text-muted">{problem ? "Nothing to show." : "Loading…"}</p>
          ) : data.recent.length === 0 ? (
            <p className="p-5 text-sm text-ink-2">
              Nothing yet.{" "}
              <Link href={`${PATHS.customers}?new=1`} className={ui.link}>
                Add your first customer
              </Link>
              .
            </p>
          ) : (
            <ul className="divide-y divide-line">
              {data.recent.map((a) => (
                <li key={a.id} className="flex items-start gap-3 px-5 py-3">
                  <span className="mt-0.5 w-12 shrink-0 text-[11px] font-medium uppercase tracking-[0.08em] text-muted">
                    {ACTIVITY_WORD[a.kind]}
                  </span>
                  <span className="min-w-0 flex-1 text-sm text-ink">
                    <Link href={`${PATHS.customers}/${a.customerId}`} className="font-medium hover:underline">
                      {a.customerName}
                    </Link>
                    <span className="text-ink-2"> · {a.text}</span>
                  </span>
                  <span className="shrink-0 text-xs tabular-nums text-muted">{shortDate(a.at)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}
