"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import { CircleAlert, Inbox, RefreshCw } from "lucide-react";
import { LOOKBACK_DAYS, runWords, type LeadInboxEntry } from "@/lib/domain/design/lead-inbox";
import { checkLeadInbox, loadLeadInbox, saveLeadInbox, type LeadInboxView } from "@/lib/services/lead-inbox";
import { ui } from "./design-shell";

const when = (iso: string) =>
  new Date(iso).toLocaleString("en-AU", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "Australia/Melbourne",
  });

/**
 * Settings → CRM → Lead inbox (20 Nov 2026, Martin: leads arriving in an email inbox synced into the CRM as new leads).
 * Choose one of the business's connected Gmail mailboxes, optionally a label, switch it on; then the latest emails it
 * took and why it passed others over.
 */
export function LeadInboxSettings() {
  const [view, setView] = useState<LeadInboxView | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [box, setBox] = useState("");
  const [label, setLabel] = useState("");
  const [busy, setBusy] = useState<"save" | "check" | null>(null);
  const [said, setSaid] = useState<string | null>(null);

  useEffect(() => {
    void loadLeadInbox().then((res) => {
      if (!res.ok) return setProblem(res.message);
      setView(res);
      setBox(
        res.settings.owner && res.settings.address
          ? `${res.settings.owner}|${res.settings.address}`
          : res.mailboxes[0]
            ? `${res.mailboxes[0].owner}|${res.mailboxes[0].address}`
            : "",
      );
      setLabel(res.settings.label ?? "");
    });
  }, []);

  const save = async (on: boolean) => {
    const [owner, address] = box ? box.split("|") : [null, null];
    setBusy("save");
    setProblem(null);
    setSaid(null);
    const res = await saveLeadInbox({ on, owner: owner ?? null, address: address ?? null, label: label.trim() || null });
    setBusy(null);
    if (!res.ok) return setProblem(res.message);
    setView((v) => (v ? { ...v, settings: res.settings, lastRunAt: res.lastRunAt, lastRun: res.lastRun } : v));
    setSaid(on ? "Switched on. It checks every ten minutes." : "Saved.");
  };

  const check = async () => {
    setBusy("check");
    setProblem(null);
    setSaid(null);
    const res = await checkLeadInbox();
    setBusy(null);
    if (!res.ok) return setProblem(res.message);
    setView((v) => (v ? { ...v, recent: res.recent, lastRun: res.run, lastRunAt: new Date().toISOString() } : v));
    if (res.run.problem) setProblem(res.run.problem);
    else setSaid(runWords(res.run));
  };

  const s = view?.settings;
  const changed = s && (box !== `${s.owner}|${s.address}` || (label.trim() || null) !== s.label);

  return (
    <div className={clsx(ui.page, "max-w-3xl")}>
      <p className={ui.eyebrow}>Settings · CRM</p>
      <h1 className="mt-2 text-[28px] leading-tight tracking-tight text-ink">Lead inbox</h1>
      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-2">
        Choose the mailbox your enquiries arrive in. Every ten minutes Sol reads what&rsquo;s new there and turns each lead into a customer
        and a deal at Lead, with the email on the deal. He passes over automated emails, your own, spam and people who already have a deal.
        An existing customer is never changed.
      </p>

      {!view && !problem && <p className="mt-6 text-sm text-muted">Loading…</p>}

      {view && (
        <div className="mt-6 rounded-2xl border border-line bg-surface p-5">
          <div className="flex items-start justify-between gap-4">
            <p className="flex items-center gap-2 text-[15px] font-medium text-ink">
              <Inbox className="size-4 text-muted" aria-hidden /> The mailbox
            </p>
            <span
              className={clsx(
                "rounded-full px-2.5 py-0.5 text-xs font-medium",
                s?.on ? "bg-positive-soft text-positive" : "bg-surface-2 text-muted",
              )}
            >
              {s?.on ? "On" : "Off"}
            </span>
          </div>
          {view.mailboxes.length === 0 ? (
            <p className="mt-2 text-sm text-ink-2">
              No Gmail is connected in your business yet.{" "}
              <Link href="/design/inbox" className={ui.link}>
                Connect one in Email
              </Link>
              , then come back and choose it.
            </p>
          ) : (
            <>
              <label className={clsx(ui.label, "mt-3")} htmlFor="lead-box">
                Where your leads arrive
              </label>
              <select id="lead-box" className={clsx(ui.input, "mt-1.5")} value={box} onChange={(e) => setBox(e.target.value)}>
                {view.mailboxes.map((m) => (
                  <option key={`${m.owner}|${m.address}`} value={`${m.owner}|${m.address}`}>
                    {m.address}
                    {m.owner !== m.address ? ` (connected by ${m.owner})` : ""}
                  </option>
                ))}
              </select>
              <label className={clsx(ui.label, "mt-4")} htmlFor="lead-label">
                Only emails with this Gmail label <span className="font-normal text-muted">(optional)</span>
              </label>
              <input
                id="lead-label"
                className={clsx(ui.input, "mt-1.5")}
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="e.g. Leads"
                maxLength={60}
              />
              <p className="mt-1.5 text-xs text-muted">
                Leave it blank to read everything coming into the inbox. With a label, automated form emails with it are read too.
              </p>
              <div className="mt-4 flex flex-wrap items-center gap-2">
                {s?.on ? (
                  <>
                    {changed && (
                      <button type="button" className={ui.primary} disabled={busy !== null} onClick={() => void save(true)}>
                        Save changes
                      </button>
                    )}
                    <button type="button" className={ui.quiet} disabled={busy !== null} onClick={() => void check()}>
                      <RefreshCw className={clsx("size-4", busy === "check" && "animate-spin")} aria-hidden />
                      {busy === "check" ? "Checking…" : "Check now"}
                    </button>
                    <button type="button" className={ui.quiet} disabled={busy !== null} onClick={() => void save(false)}>
                      Switch off
                    </button>
                  </>
                ) : (
                  <button type="button" className={ui.primary} disabled={busy !== null || !box} onClick={() => void save(true)}>
                    {busy === "save" ? "Switching on…" : "Switch on"}
                  </button>
                )}
              </div>
              <p className="mt-3 text-xs text-muted">
                It starts from when it&rsquo;s switched on (never more than {LOOKBACK_DAYS} days back). Each email takes one Sol credit to
                read; ones passed over by rule take none.
                {view.lastRunAt &&
                  ` Last checked ${when(view.lastRunAt)}${view.lastRun ? `: ${runWords(view.lastRun).replace(/\.$/, "")}` : ""}.`}
              </p>
            </>
          )}
        </div>
      )}

      {said && <p className="mt-4 rounded-xl bg-surface-2 px-4 py-3 text-sm text-ink">{said}</p>}
      {problem && (
        <p className="mt-4 flex items-start gap-2 rounded-xl bg-warning-soft px-4 py-3 text-sm text-ink" role="alert">
          <CircleAlert className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden /> {problem}
        </p>
      )}

      {view && <Recent entries={view.recent} />}
    </div>
  );
}

function Recent({ entries }: { entries: LeadInboxEntry[] }) {
  return (
    <div className="mt-6 rounded-2xl border border-line bg-surface p-5">
      <p className="text-[15px] font-medium text-ink">The latest emails</p>
      {entries.length === 0 ? (
        <p className="mt-2 text-sm text-muted">Nothing read yet. Emails show here once it has checked.</p>
      ) : (
        <ul className="mt-3 divide-y divide-line">
          {entries.map((e) => (
            <li key={e.id} className="flex items-start justify-between gap-3 py-2.5 text-sm">
              <div className="min-w-0">
                <p className="truncate text-ink">{e.subject}</p>
                <p className="truncate text-xs text-muted">
                  {e.from} · {when(e.at)}
                </p>
                <p className={clsx("mt-0.5 text-xs", e.outcome === "taken" ? "text-positive" : "text-ink-2")}>
                  {e.outcome === "taken" ? `New lead${e.customer ? `: ${e.customer}` : ""} · ${e.reason}` : `Passed over · ${e.reason}`}
                </p>
              </div>
              {e.jobId && (
                <Link href={`/design/deals/${e.jobId}`} className={clsx(ui.link, "shrink-0 text-xs")}>
                  Open deal
                </Link>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
