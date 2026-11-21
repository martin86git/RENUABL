"use client";

import { useCallback, useEffect, useState } from "react";
import clsx from "clsx";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Check, ChevronRight, X } from "lucide-react";
import { SETUP_PLACES, setupHello, setupOffered, type SetupStep, type SetupStepView } from "@/lib/domain/design/setup";
import { CONNECT_RESULTS, type CalendarProvider } from "@/lib/domain/design/my-calendar";
import { connectGmailHere, mailConnected, type MailKind } from "@/lib/services/inbox";
import { connectMyCalendar } from "@/lib/services/my-calendar";
import { SETUP_OPEN, loadSetup, putSetupAway, skipSetup, type SetupAnswer } from "@/lib/services/setup";
import { SolMark } from "./sol-icon";

const primary =
  "inline-flex h-10 items-center justify-center gap-1.5 rounded-full bg-primary px-5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:bg-line disabled:text-muted";
const light =
  "inline-flex h-10 items-center justify-center rounded-full bg-surface px-4 text-sm font-medium text-ink ring-1 ring-line transition-colors hover:bg-surface-2 disabled:text-muted";
const quiet = "text-[13px] font-medium text-ink-2 underline-offset-2 hover:text-ink hover:underline";

/**
 * Sol's setup wizard (domain/design/setup.ts; 21 Nov 2026, Martin: "there should be a Sol driven onboarding wizard -
 * surplus to the welcome tours"). Mounted once in the shell for a retailer. While something is still to do it offers
 * itself as a small pill at the foot of the page; pressed (or opened from the cog's menu) it is a window with the steps
 * down its side and one step at a time beside them: Sol's line on why it matters, and the button that does it. Each
 * step is ticked from what is really set up, so coming back from a settings page shows it done.
 */
export function SetupWizard() {
  const path = usePathname();
  const [data, setData] = useState<SetupAnswer | null>(null);
  const [open, setOpen] = useState(false);
  const [at, setAt] = useState<SetupStep | null>(null);

  const refresh = useCallback(async () => {
    const r = await loadSetup();
    if (r.ok) setData({ view: r.view, putAway: r.putAway, firstName: r.firstName });
    return r.ok ? r : null;
  }, []);

  // Read as the page changes (a settings page just saved may have finished a step) and when the tab comes back.
  useEffect(() => {
    let live = true;
    const read = () =>
      void loadSetup().then((r) => {
        if (live && r.ok) setData({ view: r.view, putAway: r.putAway, firstName: r.firstName });
      });
    read();
    const back = () => document.visibilityState === "visible" && read();
    document.addEventListener("visibilitychange", back);
    return () => {
      live = false;
      document.removeEventListener("visibilitychange", back);
    };
  }, [path]);

  useEffect(() => {
    const show = () => {
      setOpen(true);
      void refresh().then((r) => r && setAt((now) => now ?? r.view.next ?? r.view.steps[0]?.step ?? null));
    };
    window.addEventListener(SETUP_OPEN, show);
    return () => window.removeEventListener(SETUP_OPEN, show);
  }, [refresh]);

  useEffect(() => {
    if (!open) return;
    const key = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [open]);

  if (!data) return null;
  const { view } = data;
  const step = view.steps.find((s) => s.step === at) ?? view.steps.find((s) => s.step === view.next) ?? view.steps[0];

  const start = () => {
    setAt(view.next ?? view.steps[0]?.step ?? null);
    setOpen(true);
  };
  const after = (r: Awaited<ReturnType<typeof skipSetup>>, move = true) => {
    if (!r.ok) return;
    setData({ view: r.view, putAway: r.putAway, firstName: r.firstName });
    if (move) setAt(r.view.steps.find((s) => s.state === "todo")?.step ?? r.view.next);
  };

  return (
    <div className="theme-studio contents">
      {!open && setupOffered(view, data.putAway) && (
        <div className="fixed bottom-4 left-4 z-30 hidden items-center gap-1 rounded-full bg-surface py-1.5 pl-1.5 pr-1 shadow-lift ring-1 ring-line print:hidden sm:flex">
          <button type="button" onClick={start} className="flex items-center gap-2.5 rounded-full pr-2 text-left">
            <span className="sol-orb flex size-9 shrink-0 items-center justify-center">
              <SolMark className="size-9" />
            </span>
            <span>
              <span className="block text-[13px] font-semibold leading-tight text-ink">Finish setting up</span>
              <span className="block text-[11.5px] leading-tight text-muted">
                {view.done} of {view.total} done
              </span>
            </span>
          </button>
          <button
            type="button"
            title="Put this away. It stays under the cog as Set up with Sol."
            aria-label="Put setup away"
            onClick={() => void putSetupAway(true).then((r) => after(r, false))}
            className="grid size-7 place-items-center rounded-full text-muted hover:bg-surface-2 hover:text-ink"
          >
            <X className="size-3.5" aria-hidden />
          </button>
        </div>
      )}

      {open && step && (
        <div
          className="fixed inset-0 z-[80] flex items-end justify-center bg-ink/30 p-0 sm:items-center sm:p-6"
          onClick={() => setOpen(false)}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-label="Set up with Sol"
            onClick={(e) => e.stopPropagation()}
            className="flex max-h-[92dvh] w-full max-w-3xl flex-col overflow-hidden rounded-t-3xl bg-surface shadow-lift ring-1 ring-line sm:rounded-3xl"
          >
            <header className="flex items-center gap-3 border-b border-line px-5 py-4">
              <span className="sol-orb flex size-11 shrink-0 items-center justify-center">
                <SolMark className="size-11" />
              </span>
              <div className="min-w-0 flex-1">
                <h2 className="text-base font-semibold text-ink">Set up with Sol</h2>
                <p className="text-[13px] leading-snug text-ink-2">{setupHello(data.firstName, view)}</p>
              </div>
              <button
                type="button"
                aria-label="Close"
                onClick={() => setOpen(false)}
                className="grid size-8 shrink-0 place-items-center rounded-full text-muted hover:bg-surface-2 hover:text-ink"
              >
                <X className="size-4" aria-hidden />
              </button>
            </header>
            <div className="h-1 bg-surface-2" aria-hidden>
              <div
                className="h-full bg-sun-line transition-[width] duration-500"
                style={{ width: `${(view.done / Math.max(1, view.total)) * 100}%` }}
              />
            </div>
            <div className="grid min-h-0 flex-1 overflow-y-auto sm:grid-cols-[15rem_minmax(0,1fr)]">
              <ol className="border-b border-line bg-canvas p-2 sm:border-b-0 sm:border-r">
                {view.steps.map((s, i) => (
                  <li key={s.step}>
                    <button
                      type="button"
                      onClick={() => setAt(s.step)}
                      aria-current={s.step === step.step ? "step" : undefined}
                      className={clsx(
                        "flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left text-[13px] transition-colors",
                        s.step === step.step
                          ? "bg-surface font-semibold text-ink shadow-sm ring-1 ring-line"
                          : "text-ink-2 hover:bg-surface",
                      )}
                    >
                      <StepDot state={s.state} n={i + 1} />
                      <span className="min-w-0 flex-1 truncate">{s.words.title}</span>
                      {s.state === "skipped" && <span className="text-[11px] font-normal text-muted">Skipped</span>}
                    </button>
                  </li>
                ))}
              </ol>
              <StepPane
                key={step.step}
                step={step}
                onClose={() => setOpen(false)}
                onDone={() => void refresh().then((r) => r && setAt(r.view.steps.find((s) => s.state === "todo")?.step ?? step.step))}
                onSkip={() => void skipSetup(step.step, true).then((r) => after(r))}
                onUnskip={() => void skipSetup(step.step, false).then((r) => after(r, false))}
              />
            </div>
            {view.finished && (
              <footer className="border-t border-line px-5 py-3 text-right">
                <button type="button" className={primary} onClick={() => setOpen(false)}>
                  Done
                </button>
              </footer>
            )}
          </section>
        </div>
      )}
    </div>
  );
}

function StepDot({ state, n }: { state: SetupStepView["state"]; n: number }) {
  if (state === "done")
    return (
      <span className="grid size-5 shrink-0 place-items-center rounded-full bg-positive text-white">
        <Check className="size-3" aria-hidden />
      </span>
    );
  return (
    <span
      className={clsx(
        "grid size-5 shrink-0 place-items-center rounded-full text-[11px] font-semibold ring-1",
        state === "skipped" ? "text-muted ring-line" : "text-ink ring-ink/40",
      )}
    >
      {n}
    </span>
  );
}

const MAIL_WORDS: Record<string, string> = {
  failed: "That didn't connect. Try again.",
  off: "Gmail's sign-in isn't set up here yet.",
  "outlook-failed": "That didn't connect. Try again.",
  "outlook-off": "Outlook's sign-in isn't set up here yet.",
  full: "You've connected as many mailboxes as you can.",
  blocked: "Your browser blocked the sign-in window. Allow pop-ups for RENUABL and try again.",
};

function StepPane({
  step,
  onClose,
  onDone,
  onSkip,
  onUnskip,
}: {
  step: SetupStepView;
  onClose: () => void;
  onDone: () => void;
  onSkip: () => void;
  onUnskip: () => void;
}) {
  const place = SETUP_PLACES[step.step];
  const [busy, setBusy] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const done = step.state === "done";

  const mail = async (kind: MailKind) => {
    setBusy(kind);
    setProblem(null);
    const outcome = await connectGmailHere(false, kind);
    setBusy(null);
    if (mailConnected(outcome)) onDone();
    else setProblem(MAIL_WORDS[outcome] ?? "That didn't connect. Try again.");
  };
  const calendar = (provider: CalendarProvider) => {
    setBusy(provider);
    setProblem(null);
    connectMyCalendar(provider, "/design", (result) => {
      setBusy(null);
      if (result === "connected") onDone();
      else setProblem(CONNECT_RESULTS[result] ?? CONNECT_RESULTS.failed);
    });
  };

  return (
    <div className="flex flex-col gap-4 p-5 sm:p-6">
      <h3 className="text-xl font-semibold tracking-tight text-ink">{step.words.title}</h3>
      <p className="text-[14px] leading-relaxed text-ink-2">{done ? step.words.done : step.words.sol}</p>
      {step.waits && <p className="rounded-xl bg-sun px-3 py-2 text-[13px] leading-snug text-sun-ink">{step.waits}</p>}

      <div className="flex flex-wrap items-center gap-2">
        {place.connect === "email" ? (
          <>
            <button type="button" className={done ? light : primary} disabled={busy !== null} onClick={() => void mail("google")}>
              {busy === "google" ? "Connecting…" : done ? "Add another Gmail" : "Connect Gmail"}
            </button>
            <button type="button" className={light} disabled={busy !== null} onClick={() => void mail("outlook")}>
              {busy === "outlook" ? "Connecting…" : "Connect Outlook"}
            </button>
          </>
        ) : place.connect === "calendar" ? (
          !done && (
            <>
              <button type="button" className={primary} disabled={busy !== null} onClick={() => calendar("google")}>
                {busy === "google" ? "Connecting…" : "Google Calendar"}
              </button>
              <button type="button" className={light} disabled={busy !== null} onClick={() => calendar("outlook")}>
                {busy === "outlook" ? "Connecting…" : "Outlook"}
              </button>
            </>
          )
        ) : (
          <Link href={place.href} onClick={onClose} className={done ? light : primary}>
            {done ? "Change it" : step.words.action}
            <ChevronRight className="size-4" aria-hidden />
          </Link>
        )}
      </div>
      {place.also && (
        <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-muted">
          Also:
          {place.also.map((a) => (
            <Link key={a.href} href={a.href} onClick={onClose} className={quiet}>
              {a.label}
            </Link>
          ))}
        </p>
      )}
      {problem && <p className="text-[13px] text-danger">{problem}</p>}
      {!place.connect && !done && (
        <p className="text-[12.5px] leading-snug text-muted">
          It opens the page where this is done. Come back here from Finish setting up at the foot of the page, and it&apos;s ticked off once
          it&apos;s saved.
        </p>
      )}
      {!done && (
        <div className="mt-auto pt-2">
          {step.state === "skipped" ? (
            <button type="button" className={quiet} onClick={onUnskip}>
              Skipped. Put it back on my list
            </button>
          ) : (
            <button type="button" className={quiet} onClick={onSkip}>
              Skip for now
            </button>
          )}
        </div>
      )}
    </div>
  );
}
