"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import clsx from "clsx";
import { CalendarClock } from "lucide-react";
import type { Workspace } from "@/lib/domain/design/pricing";
import {
  changeWords,
  dayYearWords,
  pricedForWords,
  quoteStcLine,
  stcChanges,
  stcPricingDate,
  type StcNotice,
} from "@/lib/domain/design/stc-change";
import { todayInMarket } from "@/lib/domain/market";
import type { RebateRates } from "@/lib/domain/rebates";
import { saveWorkspace } from "@/lib/services/design-store";
import { loadRebateRates, loadStcNotice, stcApply, stcLater } from "@/lib/services/stc";

/**
 * STC changes on the screens (22 Nov 2026, Martin: "we need STC change notifications"; domain/design/stc-change.ts):
 * the notice on Today's Business view, the line under the quote's "After STCs" that says which installation period
 * the figure is for, and the setting itself on Settings → Margin and fixed costs.
 */

const SETTINGS_HREF = "/design/settings/margin#stc-period";

/**
 * Today's notice, for someone who may change settings: what changes and when, what new quotes are priced for now,
 * how many proposals out are on the earlier figures, and one press to price new quotes for the new period. "Later"
 * puts it away for that person for a week. Nothing is drawn when there is nothing to say.
 */
export function StcNoticeCard({ className }: { className?: string }) {
  const [notice, setNotice] = useState<StcNotice | null>(null);
  const [busy, setBusy] = useState(false);
  const [said, setSaid] = useState<string | null>(null);
  useEffect(() => {
    let on = true;
    void loadStcNotice().then((r) => on && r.ok && setNotice(r.notice));
    return () => {
      on = false;
    };
  }, []);
  if (!notice && !said) return null;
  const later = async () => {
    setBusy(true);
    const r = await stcLater();
    setBusy(false);
    if (r.ok) setNotice(null);
    else setSaid(r.message);
  };
  const apply = async () => {
    if (!notice?.apply) return;
    setBusy(true);
    const r = await stcApply();
    setBusy(false);
    if (!r.ok) return setSaid(r.message);
    setSaid(`Done. New quotes are now priced for installs from ${dayYearWords(r.stcFrom)}. Proposals already sent are as they were.`);
    setNotice(r.notice);
  };
  const soon = notice && notice.kind === "coming";
  return (
    <section aria-label="STC change" data-stc-notice className={clsx("rounded-[22px] bg-surface px-5 py-4 ring-1 ring-line/70", className)}>
      {notice && (
        <div className="flex items-start gap-3.5">
          <CalendarClock className="mt-0.5 size-5 shrink-0 text-warning" aria-hidden />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-baseline justify-between gap-x-3">
              <h2 className="text-[15px] font-medium text-ink">{notice.title}</h2>
              <span className="font-mono text-[12px] tabular-nums text-ink-2">
                {soon
                  ? notice.days === 1
                    ? "tomorrow"
                    : `in ${notice.days} days`
                  : notice.days === 0
                    ? "today"
                    : `${notice.days} ${notice.days === 1 ? "day" : "days"} ago`}
              </span>
            </div>
            <ul className="mt-1.5 space-y-1 text-[12.5px] leading-snug text-ink-2">
              {notice.lines.map((l) => (
                <li key={l}>{l}</li>
              ))}
            </ul>
            {notice.needed && <p className="mt-2 text-[13px] leading-snug text-ink">{notice.needed}</p>}
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {notice.apply && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void apply()}
                  className="inline-flex h-9 items-center rounded-full bg-primary px-4 text-[13px] font-medium text-primary-ink hover:bg-forest disabled:bg-surface-2 disabled:text-muted"
                >
                  {notice.apply.label}
                </button>
              )}
              {notice.outOld > 0 && (
                <Link
                  href="/design/sales/proposals"
                  className="inline-flex h-9 items-center rounded-full bg-surface px-4 text-[13px] font-medium text-ink ring-1 ring-line hover:ring-sun-line"
                >
                  Proposals sent
                </Link>
              )}
              <button
                type="button"
                disabled={busy}
                onClick={() => void later()}
                className="inline-flex h-9 items-center rounded-full px-3 text-[13px] font-medium text-ink-2 hover:text-ink"
              >
                Later
              </button>
              <Link href={SETTINGS_HREF} className="ml-auto text-[12px] text-muted underline underline-offset-2 hover:text-ink">
                Installation period setting
              </Link>
            </div>
          </div>
        </div>
      )}
      {said && (
        <p className={clsx("text-[13px] leading-snug text-ink", notice && "mt-3 border-t border-line pt-3")} role="status">
          {said}{" "}
          <Link href={SETTINGS_HREF} className="underline underline-offset-2">
            Change it in Settings
          </Link>
        </p>
      )}
    </section>
  );
}

/**
 * Under the quote's "After STCs": the installation period the figure is priced for, what this system would get after
 * a change that is near, and one press to price the business's new quotes for the other period (it is a setting for
 * every new quote, and says so). `small` is the short view: the words only.
 */
export function StcPeriodLine(props: {
  line: ReturnType<typeof quoteStcLine>;
  small?: boolean;
  workspace?: Workspace;
  onWorkspace?: (next: Workspace) => void;
}) {
  const { line, workspace } = props;
  const [said, setSaid] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  if (props.small)
    return (
      <p className={clsx("text-[10px] leading-snug", line.warn ? "text-warning" : "text-muted")} data-stc-period>
        {line.pricedFor}.{line.warn ? ` ${line.warn}` : ""}
      </p>
    );
  const set = async (stcFrom: string | null) => {
    if (!workspace) return;
    const next = { ...workspace, settings: { ...workspace.settings, stcFrom } };
    setBusy(true);
    const problem = await saveWorkspace(next);
    setBusy(false);
    if (problem) return setSaid(problem);
    setSaid(null);
    props.onWorkspace?.(next);
  };
  // The other period on offer: the new figures while a change is near, or back to today's once priced ahead.
  const offer = !workspace
    ? null
    : line.ahead
      ? { stcFrom: null, label: "Price for installs now instead" }
      : line.near
        ? { stcFrom: line.near.on, label: `Price for installs from ${dayYearWords(line.near.on)}` }
        : null;
  return (
    <div className="pt-1 text-xs leading-snug" data-stc-period>
      <p className={line.ahead ? "text-sun-ink" : "text-muted"}>{line.pricedFor}.</p>
      {line.warn && <p className="mt-0.5 text-warning">{line.warn}</p>}
      {offer && (
        <p className="mt-0.5">
          <button
            type="button"
            disabled={busy}
            onClick={() => void set(offer.stcFrom)}
            className="text-ink underline underline-offset-2 hover:text-ink-2 disabled:text-muted"
            title="A setting for every new quote your business makes. Proposals already sent don't change."
          >
            {offer.label}
          </button>
          <span className="text-muted"> · every new quote</span>
        </p>
      )}
      {said && (
        <p className="mt-0.5 text-warning" role="status">
          {said}
        </p>
      )}
    </div>
  );
}

/** Settings → Margin and fixed costs: the installation period new quotes are priced for. */
export function StcPeriodSetting(props: { workspace: Workspace; onChange: (next: Workspace) => void }) {
  const [rates, setRates] = useState<RebateRates | null>(null);
  useEffect(() => {
    let on = true;
    void loadRebateRates().then((r) => on && setRates(r));
    return () => {
      on = false;
    };
  }, []);
  const today = todayInMarket();
  const { stcFrom } = props.workspace.settings;
  const chosen = stcPricingDate(stcFrom, today) > today ? stcFrom : null;
  // The next two changes the rules give, and the one chosen if it lies further out.
  const coming = rates ? stcChanges(rates).filter((c) => c.on > today) : [];
  const offered = coming.filter((c, i) => i < 2 || c.on === chosen);
  const pick = (value: string | null) => props.onChange({ ...props.workspace, settings: { ...props.workspace.settings, stcFrom: value } });
  const row = "flex cursor-pointer items-start gap-3 rounded-md px-3 py-2.5 ring-1 ring-line has-[:checked]:ring-ink";
  return (
    <section
      id="stc-period"
      className="scroll-mt-24 rounded-lg bg-surface p-5 shadow-[var(--shadow-soft)] ring-1 ring-line sm:p-6"
      aria-label="Installation period for STCs"
    >
      <h2 className="text-[19px] tracking-tight text-ink">Installation period for STCs</h2>
      <p className="mt-1 max-w-2xl text-sm text-ink-2">
        STCs are worked out for the day a system is installed, and they step down over time. Choose the installation period new quotes and
        proposals are priced for. Proposals already sent keep the figures they were sent with.
      </p>
      <div className="mt-4 space-y-2 text-sm text-ink">
        <label className={row}>
          <input type="radio" name="stc-from" className="mt-1" checked={chosen === null} onChange={() => pick(null)} />
          <span>
            <span className="block font-medium">The day the quote is made</span>
            <span className="block text-xs text-ink-2">
              {rates ? `Now: ${pricedForWords(null, today, rates)}.` : "Today's figures."} It moves on to the new figures by itself on the
              day they change.
            </span>
          </span>
        </label>
        {offered.map((c) => (
          <label key={c.on} className={row}>
            <input type="radio" name="stc-from" className="mt-1" checked={chosen === c.on} onChange={() => pick(c.on)} />
            <span>
              <span className="block font-medium">Installs from {dayYearWords(c.on)}</span>
              <span className="block text-xs text-ink-2">{changeWords(c)}</span>
            </span>
          </label>
        ))}
        {chosen && !offered.some((c) => c.on === chosen) && (
          <label className={row}>
            <input type="radio" name="stc-from" className="mt-1" checked readOnly />
            <span className="font-medium">Installs from {dayYearWords(chosen)}</span>
          </label>
        )}
      </div>
      <p className="mt-3 text-xs text-muted">
        {rates ? `From the rebate rules as at ${rates.asOf}. ` : ""}Every STC figure is an estimate: the Clean Energy Regulator decides what
        a system is entitled to when it is installed.
      </p>
    </section>
  );
}
