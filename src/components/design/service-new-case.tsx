"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, MapPin, Plus, Search, Wrench } from "lucide-react";
import clsx from "clsx";
import { STAGE_LABELS } from "@/lib/domain/design/crm";
import { ALREADY_OPEN, MAX_ISSUE, serviceDealMatches, type ServiceCase } from "@/lib/domain/design/service";
import { listJobs, raiseService, type JobLine } from "@/lib/services/crm";
import { ui } from "./design-shell";

/** The business's deals, read once a visit for every card on the screen. */
let dealsOnce: Promise<JobLine[] | string> | null = null;
const loadDeals = () =>
  (dealsOnce ??= listJobs().then((r) => {
    if (!r.ok) {
      dealsOnce = null;
      return r.message;
    }
    return r.jobs;
  }));

/**
 * The card that starts a service case (8 Nov 2026, Martin), raised by the + on the cases or by Sol when asked to start
 * one: find the deal by the customer's name, the deal or the address (it searches as they type, `serviceDealMatches`),
 * say what needs putting right, and Flag for service raises it on that deal (written on its record, as from the deal's
 * own Service card). Nothing is flagged until that press.
 */
export function NewCaseCard({
  query = "",
  issue = "",
  onFlagged,
  onOpenCase,
}: {
  query?: string;
  issue?: string;
  /** The case raised. */
  onFlagged: (c: ServiceCase) => void;
  /** The deal already has a case open: show that one. */
  onOpenCase: (jobId: string) => void;
}) {
  const [deals, setDeals] = useState<JobLine[] | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [typed, setTyped] = useState(query);
  const [deal, setDeal] = useState<JobLine | null>(null);
  const [words, setWords] = useState(issue);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [alreadyOpen, setAlreadyOpen] = useState(false);
  const search = useRef<HTMLInputElement>(null);
  const issueBox = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    let live = true;
    void loadDeals().then((d) => {
      if (!live) return;
      if (typeof d === "string") setProblem(d);
      else setDeals(d);
    });
    search.current?.focus({ preventScroll: true });
    return () => {
      live = false;
    };
  }, []);

  const found = useMemo(() => serviceDealMatches(deals ?? [], typed), [deals, typed]);

  const choose = (d: JobLine) => {
    setDeal(d);
    setAlreadyOpen(false);
    setProblem(null);
    // Straight to the issue, so what is typed next lands there.
    issueBox.current?.focus({ preventScroll: true });
  };

  const flag = async () => {
    if (!deal || !words.trim() || busy) return;
    setBusy(true);
    const res = await raiseService(deal.id, words);
    setBusy(false);
    if (!res.ok) {
      setAlreadyOpen(res.message === ALREADY_OPEN);
      return setProblem(res.message);
    }
    setDone(true);
    window.dispatchEvent(new Event("renuabl:service"));
    onFlagged(res.case);
  };

  if (done && deal)
    return (
      <div className={clsx(ui.card, "flex items-center gap-2.5 px-4 py-3 text-[14px] text-ink")}>
        <Check className="size-4 shrink-0 text-positive" aria-hidden />
        Flagged for service on {deal.customerName}&apos;s deal.
      </div>
    );

  return (
    <div className={clsx(ui.card, "max-w-xl space-y-3 p-4")}>
      <p className="flex items-center gap-2 text-[13px] font-semibold text-ink">
        <Wrench className="size-4 text-sun-line" aria-hidden /> New service case
      </p>

      {deal ? (
        <div className="flex items-start gap-3 rounded-md bg-surface-2 px-3 py-2.5">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-ink">{deal.customerName}</p>
            <p className="truncate text-xs text-muted">
              {deal.title} · {STAGE_LABELS[deal.stage]}
              {deal.address && ` · ${deal.address}`}
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              setDeal(null);
              window.setTimeout(() => search.current?.focus(), 0);
            }}
            className="tap-area shrink-0 text-xs text-ink-2 underline underline-offset-4 hover:text-ink"
          >
            Change
          </button>
        </div>
      ) : (
        <div>
          <label className="relative block">
            <span className="sr-only">Which deal is it for?</span>
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden />
            <input
              ref={search}
              className={clsx(ui.input, "pl-9")}
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && found.length) {
                  e.preventDefault();
                  choose(found[0]);
                }
              }}
              placeholder="Which deal? A customer's name, the deal or the address"
              autoComplete="off"
            />
          </label>
          <ul className="mt-1.5 divide-y divide-line overflow-hidden rounded-md ring-1 ring-line" role="listbox" aria-label="Deals">
            {deals === null && !problem ? (
              <li className="px-3 py-2.5 text-[13px] text-muted">Finding your deals…</li>
            ) : found.length ? (
              found.map((d) => (
                <li key={d.id}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={false}
                    onClick={() => choose(d)}
                    className="flex w-full items-start gap-2.5 bg-surface px-3 py-2 text-left hover:bg-surface-2"
                  >
                    <MapPin className="mt-0.5 size-3.5 shrink-0 text-muted" aria-hidden />
                    <span className="min-w-0">
                      <span className="block truncate text-[13px] font-medium text-ink">
                        {d.customerName} <span className="font-normal text-muted">· {d.title}</span>
                      </span>
                      <span className="block truncate text-xs text-muted">
                        {STAGE_LABELS[d.stage]}
                        {d.address && ` · ${d.address}`}
                      </span>
                    </span>
                  </button>
                </li>
              ))
            ) : (
              deals !== null && (
                <li className="px-3 py-2.5 text-[13px] text-muted">
                  {typed.trim()
                    ? "No deal matches that yet. Keep typing, or try the address."
                    : "Type a customer's name, the deal or the address."}
                </li>
              )
            )}
          </ul>
        </div>
      )}

      <label className="block">
        <span className="mb-1 block text-xs text-muted">What needs putting right?</span>
        <textarea
          ref={issueBox}
          className={clsx(ui.input, "min-h-20 py-2 text-[13px]")}
          value={words}
          maxLength={MAX_ISSUE}
          onChange={(e) => setWords(e.target.value)}
          placeholder="e.g. Inverter showing an earth fault since Monday"
        />
      </label>

      {problem && (
        <p className="flex flex-wrap items-center gap-2 text-xs text-danger">
          {problem}
          {alreadyOpen && deal && (
            <button type="button" onClick={() => onOpenCase(deal.id)} className="text-ink underline underline-offset-4">
              Show that case
            </button>
          )}
        </p>
      )}
      <div className="flex items-center gap-2">
        <button
          type="button"
          className={clsx(ui.primary, "h-9 px-3.5 text-[13px]")}
          disabled={!deal || !words.trim() || busy}
          onClick={() => void flag()}
        >
          <Wrench className="size-3.5" aria-hidden /> {busy ? "Flagging…" : "Flag for service"}
        </button>
        {!deal && <span className="text-xs text-muted">Pick the deal first.</span>}
      </div>
    </div>
  );
}

/** The + that starts a new case, beside the cases' heading. */
export function NewCaseButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title="New service case"
      aria-label="New service case"
      className="grid size-8 shrink-0 place-items-center rounded-full bg-primary text-primary-ink shadow-[0_2px_8px_rgb(20_22_26_/_0.15)] hover:bg-primary/90"
    >
      <Plus className="size-4" aria-hidden />
    </button>
  );
}
