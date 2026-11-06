"use client";

import { useCallback, useEffect, useState } from "react";
import clsx from "clsx";
import { CalendarDays, Check, Mail, UserPlus } from "lucide-react";
import { CONNECT_RESULTS, type CalendarProvider } from "@/lib/domain/design/my-calendar";
import { TEAM_LEVELS, levelPermissions, welcomeLines, welcomeSteps, type TeamLevel, type WelcomeStep } from "@/lib/domain/design/welcome";
import { todayInMarket } from "@/lib/domain/market";
import { addMember, finishWelcome, setMemberPermissions } from "@/lib/services/design-account";
import { connectGmailHere, loadInbox, type GmailOutcome } from "@/lib/services/inbox";
import { connectMyCalendar, loadMyCalendar } from "@/lib/services/my-calendar";
import { skipNewLook } from "./new-look";
import { SolSays, Typed } from "./today-pad";

type Stage = "hello" | WelcomeStep | "done";

const card = "mt-4 max-w-xl rounded-2xl bg-surface p-4 ring-1 ring-line sm:p-5";
const pill =
  "inline-flex h-10 items-center gap-2 rounded-full px-4 text-[14px] font-medium transition disabled:cursor-not-allowed disabled:bg-surface-2 disabled:text-muted";
const dark = `${pill} bg-primary text-primary-ink hover:brightness-110`;
const light = `${pill} bg-surface text-ink ring-1 ring-line hover:ring-ink-2`;
const quiet = "text-[13px] font-medium text-ink-2 underline underline-offset-4 hover:text-ink";

const GMAIL_WORDS: Partial<Record<GmailOutcome, string>> = {
  failed: "Your Gmail couldn't be connected. Try again.",
  off: "Google sign-in isn't set up on this site yet, so Gmail can't be connected.",
  "signed-out": "Sign in again to connect your Gmail.",
  "read-only":
    "Gmail is connected, but read only: Google wasn't given permission to organise your email. Connect it again and leave every box ticked on Google's page to mark read and archive from here.",
};

/**
 * The welcome on Today (5 Nov 2026, Martin; welcome.ts): in place of the greeting, Sol types to the person, then each
 * step comes up in turn as he gets to it: connect email and calendar, add the team with Admin or User (the owner only),
 * and a spotlight tour of the page. Each step can be skipped; finishing or skipping the lot is kept (`finishWelcome`)
 * and Today opens as usual.
 */
export function Welcome({
  firstName,
  business,
  owner,
  onDone,
  onTour,
}: {
  firstName: string | null;
  business: string;
  owner: boolean;
  onDone: () => void;
  /** Show me around: the welcome ends and Today runs the tour over the page as it normally looks. */
  onTour: () => void;
}) {
  const stages: Stage[] = ["hello", ...welcomeSteps(owner), "done"];
  const lines = welcomeLines(firstName, business);
  const [at, setAt] = useState(0);
  // Which stages have finished typing: a step's card shows once Sol has said it.
  const [said, setSaid] = useState<Set<Stage>>(new Set());
  const next = useCallback(() => setAt((n) => Math.min(n + 1, stages.length - 1)), [stages.length]);
  const heard = (s: Stage) => () => {
    setSaid((all) => new Set(all).add(s));
    if (s === "hello") window.setTimeout(next, 500);
  };
  const end = () => {
    skipNewLook();
    void finishWelcome();
    onDone();
  };

  return (
    <div className="mx-auto w-full max-w-3xl flex-1 space-y-7 pb-10 pt-2" aria-live="polite">
      {stages.slice(0, at + 1).map((s) => (
        <SolSays key={s}>
          <div className="text-[16px] leading-relaxed text-ink">
            <Typed text={lines[s]} onDone={heard(s)} />
          </div>
          {said.has(s) && s === "connect" && <ConnectStep onNext={next} current={stages[at] === "connect"} />}
          {said.has(s) && s === "team" && <TeamStep onNext={next} current={stages[at] === "team"} />}
          {said.has(s) && s === "tour" && stages[at] === "tour" && (
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <button
                type="button"
                className={dark}
                onClick={() => {
                  skipNewLook();
                  void finishWelcome();
                  onTour();
                }}
              >
                Show me around
              </button>
              <button type="button" className={quiet} onClick={next}>
                Skip the tour
              </button>
            </div>
          )}
          {said.has(s) && s === "done" && (
            <div className="mt-4">
              <button type="button" className={dark} onClick={end}>
                Go to Today
              </button>
            </div>
          )}
        </SolSays>
      ))}
      {at < stages.length - 1 && (
        <p className="text-center">
          <button type="button" className={quiet} onClick={end}>
            Skip setting up for now
          </button>
        </p>
      )}
    </div>
  );
}

/** Connect your email and calendar, each in a small window over the page (nobody leaves Today). */
function ConnectStep({ onNext, current }: { onNext: () => void; current: boolean }) {
  const [gmail, setGmail] = useState<string | null>(null);
  const [calendar, setCalendar] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  useEffect(() => {
    let gone = false;
    const today = todayInMarket();
    void loadInbox().then((r) => !gone && r.ok && r.connected && setGmail(r.addresses?.[0] ?? r.address ?? "Gmail"));
    void loadMyCalendar(today, today).then((r) => !gone && r.ok && r.connected && setCalendar(r.address ?? "Your calendar"));
    return () => {
      gone = true;
    };
  }, []);
  const gmailNow = async () => {
    setBusy("gmail");
    setProblem(null);
    const outcome = await connectGmailHere(false);
    setBusy(null);
    if (outcome === "connected" || outcome === "read-only") {
      const r = await loadInbox();
      setGmail(r.ok ? (r.addresses?.[0] ?? r.address ?? "Gmail") : "Gmail");
    }
    if (outcome !== "connected") setProblem(GMAIL_WORDS[outcome] ?? null);
  };
  const calendarNow = (provider: CalendarProvider) => {
    setBusy(provider);
    setProblem(null);
    connectMyCalendar(provider, "/design", (result) => {
      setBusy(null);
      if (result === "connected") setCalendar(provider === "google" ? "Google Calendar" : "Outlook");
      else setProblem(CONNECT_RESULTS[result] ?? CONNECT_RESULTS.failed);
    });
  };
  return (
    <div className={card}>
      <Row icon={<Mail className="size-4" aria-hidden />} title="Email" done={gmail}>
        <button type="button" className={light} onClick={() => void gmailNow()} disabled={busy !== null}>
          {busy === "gmail" ? "Connecting…" : "Connect Gmail"}
        </button>
      </Row>
      <Row icon={<CalendarDays className="size-4" aria-hidden />} title="Calendar" done={calendar}>
        <button type="button" className={light} onClick={() => calendarNow("google")} disabled={busy !== null}>
          {busy === "google" ? "Connecting…" : "Google Calendar"}
        </button>
        <button type="button" className={light} onClick={() => calendarNow("outlook")} disabled={busy !== null}>
          {busy === "outlook" ? "Connecting…" : "Outlook"}
        </button>
      </Row>
      {problem && (
        <p className="mt-3 text-[13px] text-danger" role="alert">
          {problem}
        </p>
      )}
      {current && (
        <div className="mt-4 flex items-center gap-3 border-t border-line pt-4">
          <button type="button" className={dark} onClick={onNext}>
            {gmail || calendar ? "Next" : "Skip for now"}
          </button>
          {!(gmail || calendar) && (
            <span className="text-[12px] text-muted">You can connect them later from the date or the envelope up top.</span>
          )}
        </div>
      )}
    </div>
  );
}

function Row({ icon, title, done, children }: { icon: React.ReactNode; title: string; done: string | null; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-3 py-2">
      <span className="inline-flex size-9 items-center justify-center rounded-full bg-surface-2 text-ink-2">{icon}</span>
      <span className="min-w-24 text-[15px] font-medium text-ink">{title}</span>
      <span className="ml-auto flex flex-wrap items-center gap-2">
        {done ? (
          <span className="inline-flex items-center gap-1.5 text-[14px] text-positive">
            <Check className="size-4" aria-hidden /> {done}
          </span>
        ) : (
          children
        )}
      </span>
    </div>
  );
}

/** Add the team, each as Admin or User (welcome.ts `TEAM_LEVELS`), set as permissions the server enforces. */
function TeamStep({ onNext, current }: { onNext: () => void; current: boolean }) {
  const [email, setEmail] = useState("");
  const [level, setLevel] = useState<TeamLevel>("user");
  const [added, setAdded] = useState<{ email: string; level: TeamLevel }[]>([]);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    const who = email.trim().toLowerCase();
    if (!who) return;
    setBusy(true);
    setProblem(null);
    const made = await addMember(who);
    const set = made.problem ? made : await setMemberPermissions(who, levelPermissions(level));
    setBusy(false);
    if (set.problem) return setProblem(set.problem);
    setAdded((all) => [...all.filter((a) => a.email !== who), { email: who, level }]);
    setEmail("");
  };
  return (
    <div className={card}>
      <form onSubmit={add} className="flex flex-col gap-3 sm:flex-row sm:items-end" noValidate>
        <label className="block flex-1 text-[13px] font-medium text-ink">
          Their email
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="off"
            placeholder="name@yourcompany.com.au"
            className="mt-1.5 h-10 w-full rounded-lg bg-surface px-3 text-[15px] text-ink ring-1 ring-line focus:outline-none focus:ring-2 focus:ring-sun-line"
          />
        </label>
        <div role="radiogroup" aria-label="Permission level" className="inline-flex rounded-full bg-surface-2 p-1">
          {TEAM_LEVELS.map((l) => (
            <button
              key={l.level}
              type="button"
              role="radio"
              aria-checked={level === l.level}
              onClick={() => setLevel(l.level)}
              title={l.about}
              className={clsx(
                "h-8 rounded-full px-3.5 text-[13px] font-medium transition",
                level === l.level ? "bg-surface text-ink shadow-sm ring-1 ring-line" : "text-ink-2 hover:text-ink",
              )}
            >
              {l.label}
            </button>
          ))}
        </div>
        <button type="submit" className={dark} disabled={busy || !email.trim()}>
          <UserPlus className="size-4" aria-hidden /> {busy ? "Adding…" : "Add"}
        </button>
      </form>
      <p className="mt-2 text-[12px] leading-snug text-muted">{TEAM_LEVELS.find((l) => l.level === level)?.about}</p>
      {added.length > 0 && (
        <ul className="mt-3 divide-y divide-line border-t border-line">
          {added.map((a) => (
            <li key={a.email} className="flex items-center justify-between gap-3 py-2 text-[14px]">
              <span className="truncate text-ink">{a.email}</span>
              <span className="shrink-0 text-ink-2">{TEAM_LEVELS.find((l) => l.level === a.level)?.label}</span>
            </li>
          ))}
        </ul>
      )}
      {problem && (
        <p className="mt-3 text-[13px] text-danger" role="alert">
          {problem}
        </p>
      )}
      {current && (
        <div className="mt-4 flex items-center gap-3 border-t border-line pt-4">
          <button type="button" className={dark} onClick={onNext}>
            {added.length ? "Next" : "Just me for now"}
          </button>
          <span className="text-[12px] text-muted">They sign in with their email. Nobody is emailed by this.</span>
        </div>
      )}
    </div>
  );
}
