"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, PenTool, ReceiptText, UserPlus, Users } from "lucide-react";
import clsx from "clsx";
import { Wordmark } from "@/components/ui/primitives";
import { STAGE_LABELS, WON_STAGES, type JobStage } from "@/lib/domain/design/crm";
import { PIPELINES, dashboard, power } from "@/lib/domain/design/deal";
import { todayInMarket } from "@/lib/domain/market";
import { dollars, listJobs, loadOverview, shortDate, type JobLine, type Overview } from "@/lib/services/crm";
import { requestSignInLink } from "@/lib/services/design-account";
import { useDesignAccount } from "./design-account";
import { DesignerDemo } from "./designer-demo";
import { DesignShell, PATHS, PageHead, ui } from "./design-shell";

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
export const ACTIVITY_WORD = { note: "Note", call: "Call", email: "Email", stage: "Stage", proposal: "Proposal" } as const;

const POINTS = [
  { icon: PenTool, title: "Design", body: "See the roof from above, lay out the panels and check the strings against the inverter." },
  { icon: ReceiptText, title: "Quote", body: "The quote builds as you draw, from your own price lists, installation rates and margin." },
  { icon: Users, title: "Customers", body: "Keep each customer, their jobs and what was said in one place, from lead to installed." },
] as const;

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
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [answer, setAnswer] = useState<{ ok: boolean; message: string } | null>(null);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const res = await requestSignInLink(email.trim(), PATHS.home);
    setBusy(false);
    setAnswer({ ok: res.ok, message: res.message ?? (res.ok ? "Check your email for the link." : "That didn't work. Try again.") });
  };
  return (
    <div className="theme-studio flex min-h-dvh flex-col">
      <header className="flex h-16 items-center justify-between px-5 lg:px-10">
        <Wordmark />
        <Link href={PATHS.designer} className="text-[13px] font-medium text-ink-2 underline underline-offset-4 hover:text-ink">
          Try the design tool
        </Link>
      </header>
      <main className="mx-auto grid w-full max-w-6xl flex-1 items-center gap-10 px-5 pb-20 pt-8 lg:grid-cols-[minmax(0,1fr)_24rem] lg:gap-16 lg:px-10">
        <div>
          <p className={ui.eyebrow}>For solar installers and retailers</p>
          <h1 className="mt-4 text-[38px] leading-[1.05] tracking-tight text-ink sm:text-[54px]">Design it. Quote it. Win the job.</h1>
          <p className="mt-5 max-w-xl text-[17px] leading-relaxed text-ink-2">
            One place for your solar business: lay out a roof, see the quote build beside it, and keep every customer and job moving from
            lead to installed.
          </p>
          <ul className="mt-10 grid gap-4 sm:grid-cols-3">
            {POINTS.map(({ icon: Icon, title, body }) => (
              <li key={title} className="border-t border-line-strong pt-4">
                <Icon className="size-5 text-sun-line" aria-hidden />
                <p className="mt-3 text-[15px] font-medium text-ink">{title}</p>
                <p className="mt-1 text-[13.5px] leading-snug text-ink-2">{body}</p>
              </li>
            ))}
          </ul>
        </div>

        <section className={clsx(ui.card, "p-6 sm:p-7")} aria-labelledby="sign-in">
          <h2 id="sign-in" className="text-[20px] tracking-tight text-ink">
            Sign in
          </h2>
          <p className="mt-2 text-[14px] leading-relaxed text-ink-2">
            Enter your email and we&apos;ll send a link that signs you in. No password. New here? The same link sets up your business.
          </p>
          {unreachable && (
            <p className="mt-4 rounded-md bg-warning-soft px-3 py-2.5 text-[13px] text-warning" role="alert">
              We couldn&apos;t reach your account just now. Try again in a moment.
            </p>
          )}
          {answer?.ok ? (
            <p className="mt-5 rounded-md bg-surface-2 px-4 py-3 text-[14px] leading-relaxed text-ink" role="status">
              {answer.message}
            </p>
          ) : (
            <form onSubmit={submit} className="mt-5 space-y-3">
              <label className={ui.label}>
                Email
                <input
                  type="email"
                  required
                  className={clsx(ui.input, "mt-1.5 min-h-11")}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  placeholder="you@yourbusiness.com.au"
                />
              </label>
              {answer && (
                <p className="text-[13px] text-danger" role="alert">
                  {answer.message}
                </p>
              )}
              <button type="submit" className={clsx(ui.primary, "h-11 w-full")} disabled={busy}>
                {busy ? "Sending…" : "Email me a sign-in link"}
              </button>
            </form>
          )}
          <p className="mt-5 border-t border-line pt-4 text-[13px] leading-relaxed text-muted">
            Just looking?{" "}
            <Link href={PATHS.designer} className="font-medium text-ink-2 underline underline-offset-4 hover:text-ink">
              Use the design tool without an account
            </Link>
            : your work stays on this device.
          </p>
        </section>
      </main>
      {/* The second screen: the design tool at work. */}
      <section className="border-t border-line bg-surface px-5 py-16 lg:px-10 lg:py-24" aria-labelledby="demo">
        <div className="mx-auto grid w-full max-w-6xl items-center gap-10 lg:grid-cols-[20rem_minmax(0,1fr)] lg:gap-14">
          <div>
            <p className={ui.eyebrow}>The design tool</p>
            <h2 id="demo" className="mt-3 text-[30px] leading-[1.1] tracking-tight text-ink sm:text-[38px]">
              From a bare roof to a strung array.
            </h2>
            <p className="mt-4 text-[15px] leading-relaxed text-ink-2">
              Drag out an array, add the inverter, and run the strings through the panels. The system&apos;s size and its quote keep up with
              every panel you place.
            </p>
            <Link href={PATHS.designer} className={clsx(ui.primary, "mt-6 h-11 px-5")}>
              <PenTool className="size-4" aria-hidden /> Try it on a real roof
            </Link>
          </div>
          <DesignerDemo />
        </div>
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
