"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, PenTool, ReceiptText, UserPlus, Users } from "lucide-react";
import clsx from "clsx";
import { Wordmark } from "@/components/ui/primitives";
import { JOB_STAGES, STAGE_LABELS, type JobStage } from "@/lib/domain/design/crm";
import { dollars, loadOverview, shortDate, type Overview } from "@/lib/services/crm";
import { requestSignInLink } from "@/lib/services/design-account";
import { useDesignAccount } from "./design-account";
import { DesignShell, PATHS, PageHead, ui } from "./design-shell";

/** A stage as a small tag. Won and installed are the good news; lost is quiet. */
export function StageTag({ stage }: { stage: JobStage }) {
  return (
    <span
      className={clsx(
        "inline-flex h-6 items-center whitespace-nowrap rounded px-2 text-[11px] font-medium uppercase tracking-[0.08em]",
        stage === "won" || stage === "installed"
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
export const ACTIVITY_WORD = { note: "Note", call: "Call", email: "Email", stage: "Stage" } as const;

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
    </div>
  );
}

/** The business at a glance: where its jobs stand, what they are worth, and what happened last. */
function OverviewPage({ business }: { business: string }) {
  const [data, setData] = useState<Overview | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  useEffect(() => {
    let gone = false;
    void loadOverview().then((res) => {
      if (gone) return;
      if (res.ok) setData(res);
      else setProblem(res.message);
    });
    return () => {
      gone = true;
    };
  }, []);

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

      <section className="mt-8 grid gap-3 sm:grid-cols-3" aria-label="Totals">
        {(
          [
            ["Open pipeline", data ? dollars(data.openValue) : "–", "Quoted value of jobs not yet won or lost"],
            ["Won", data ? dollars(data.wonValue) : "–", "Quoted value of jobs won and installed"],
            ["Customers", data ? String(data.customers) : "–", "Everyone in your list"],
          ] as const
        ).map(([name, value, under]) => (
          <div key={name} className={clsx(ui.card, "p-5")}>
            <p className={ui.eyebrow}>{name}</p>
            <p className="mt-2 text-[30px] font-medium leading-none tabular-nums tracking-tight text-ink">{value}</p>
            <p className="mt-2 text-[12.5px] text-muted">{under}</p>
          </div>
        ))}
      </section>

      <section className="mt-8" aria-labelledby="stages">
        <div className="flex items-baseline justify-between">
          <h2 id="stages" className="text-[17px] tracking-tight text-ink">
            Jobs by stage
          </h2>
          <Link href={PATHS.sales} className={clsx(ui.link, "text-[13px]")}>
            Open sales <ArrowRight className="inline size-3.5" aria-hidden />
          </Link>
        </div>
        <ol className={clsx(ui.card, "mt-3 grid grid-cols-2 divide-line sm:grid-cols-3 lg:grid-cols-6 lg:divide-x")}>
          {JOB_STAGES.map((stage) => (
            <li key={stage} className="p-4">
              <p className="text-[26px] font-medium leading-none tabular-nums text-ink">{data ? data.counts[stage] : "–"}</p>
              <p className="mt-2 text-[12.5px] text-ink-2">{STAGE_LABELS[stage]}</p>
            </li>
          ))}
        </ol>
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
