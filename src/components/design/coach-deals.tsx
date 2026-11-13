"use client";

import { useEffect, useState } from "react";
import clsx from "clsx";
import { ArrowLeft, ChevronDown, Radio, Search } from "lucide-react";
import {
  STANDING_WORDS,
  dealGroups,
  dealsSummary,
  searchDeals,
  type AssistantDeal,
  type AssistantDealCall,
  type DealStanding,
} from "@/lib/domain/design/assistant-deals";
import { watchAssistantCall } from "@/lib/services/assistant-call";
import { useCallerInfo } from "@/lib/services/caller";
import { loadAssistantDeals, loadDealCalls } from "@/lib/services/coaching";
import { AfterCall } from "./assistant-call";

const POLL_MS = 20_000;
const DEALS_CHANGED = "renuabl:assistant-deals";

/** The dot beside a deal: orange where a person or a call is the next thing, quiet for the rest. */
const DOT: Record<DealStanding, string> = {
  "needs-you": "bg-danger",
  live: "bg-sun-line animate-pulse motion-reduce:animate-none",
  "lined-up": "bg-sun-line",
  spoke: "bg-positive",
  "no-answer": "bg-line",
};

const when = (iso: string) => {
  const d = new Date(iso);
  const today = new Date().toDateString() === d.toDateString();
  return today
    ? d.toLocaleTimeString("en-AU", { hour: "numeric", minute: "2-digit" })
    : d.toLocaleDateString("en-AU", { day: "numeric", month: "short" });
};

/**
 * The deals the phone assistant is across, beside its chat (14 Nov 2026, Martin: a side window to the left of the
 * assistant's interface, split screen, wider than the chat, so a deal can be picked and talked about with it
 * directly). The list is its own work only: deals it has rung, is on a call with or has a call lined up for, by where
 * each stands. Picking one opens it in the pane (its calls as they were said, call back to ask, text, open the deal)
 * and the chat beside it is then about that deal. On a phone the pane takes the window's place.
 */
export function CoachDeals(props: { picked: AssistantDeal | null; onPick: (d: AssistantDeal | null) => void; onBack: () => void }) {
  const { caller, callsOn, textsOn } = useCallerInfo();
  const [deals, setDeals] = useState<AssistantDeal[] | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [typed, setTyped] = useState("");
  const name = caller.name;
  const { picked, onPick } = props;

  useEffect(() => {
    let live = true;
    const read = () =>
      void loadAssistantDeals().then((res) => {
        if (!live) return;
        if (!res.ok) return setFailed(res.message);
        setFailed(null);
        setDeals(res.deals);
      });
    read();
    const t = window.setInterval(() => !document.hidden && read(), POLL_MS);
    window.addEventListener(DEALS_CHANGED, read);
    return () => {
      live = false;
      window.clearInterval(t);
      window.removeEventListener(DEALS_CHANGED, read);
    };
  }, []);

  // The deal picked, as the list has it now (a call lined up since it was picked shows at once).
  const now = picked ? (deals?.find((d) => d.jobId === picked.jobId) ?? picked) : null;
  const shown = searchDeals(deals ?? [], typed);

  return (
    <aside
      aria-label={`${name}'s deals`}
      className="flex w-full shrink-0 flex-col border-line bg-canvas sm:w-[20rem] sm:border-r lg:w-[34rem]"
    >
      <button
        type="button"
        onClick={props.onBack}
        className="flex items-center gap-1.5 border-b border-line px-4 py-2.5 text-xs font-medium text-ink-2 hover:text-ink sm:hidden"
      >
        <ArrowLeft className="size-3.5" aria-hidden /> Back to the chat
      </button>
      {now ? (
        <DealOpen
          key={now.jobId}
          deal={now}
          onBack={() => onPick(null)}
          actions={
            <AfterCall
              jobId={now.jobId}
              customer={now.customer.split(" ")[0] || now.customer}
              caller={caller}
              ended
              sales
              callsOn={callsOn}
              textsOn={textsOn}
              transcriptId={null}
              onDone={() => window.dispatchEvent(new Event(DEALS_CHANGED))}
            />
          }
        />
      ) : (
        <>
          <div className="border-b border-line px-4 py-3">
            <p className="text-sm font-semibold text-ink">{name}&apos;s deals</p>
            <p className="text-xs text-muted">
              {deals ? dealsSummary(deals) : "Loading…"} · the customers {name} has rung or is about to
            </p>
            <label className="mt-2.5 flex items-center gap-2 rounded-full bg-surface px-3 py-1.5 ring-1 ring-line focus-within:ring-sun-line">
              <Search className="size-3.5 shrink-0 text-muted" aria-hidden />
              <input
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                placeholder="Find a customer or address"
                aria-label={`Search ${name}'s deals`}
                className="min-w-0 flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-muted"
              />
            </label>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">
            {failed && <p className="px-4 py-3 text-xs text-danger">{failed}</p>}
            {deals && deals.length === 0 && (
              <p className="px-4 py-6 text-sm text-ink-2">
                {name} hasn&apos;t rung anyone yet. Hand a deal&apos;s call to {name} and it shows here with what came of it.
              </p>
            )}
            {deals && deals.length > 0 && shown.length === 0 && <p className="px-4 py-6 text-sm text-ink-2">No deal matches that.</p>}
            {dealGroups(shown).map((g) => (
              <section key={g.standing} aria-label={STANDING_WORDS[g.standing]}>
                <h3 className="sticky top-0 z-[1] flex items-center gap-2 bg-canvas px-4 pb-1.5 pt-3 text-[11px] font-semibold uppercase tracking-wide text-ink-2">
                  <span className={clsx("size-2 rounded-full", DOT[g.standing])} aria-hidden />
                  {STANDING_WORDS[g.standing]}
                  <span className="font-normal text-muted">{g.deals.length}</span>
                </h3>
                <ul className="space-y-1.5 px-3 pb-2">
                  {g.deals.map((d) => (
                    <li key={d.jobId}>
                      <button
                        type="button"
                        onClick={() => onPick(d)}
                        className="block w-full rounded-xl bg-surface px-3 py-2.5 text-left ring-1 ring-line transition hover:ring-sun-line"
                      >
                        <span className="flex items-baseline justify-between gap-3">
                          <span className="truncate text-sm font-semibold text-ink">{d.customer}</span>
                          <span className="shrink-0 text-[11px] tabular-nums text-muted">{when(d.at)}</span>
                        </span>
                        <span className="block truncate text-xs text-ink-2">
                          {d.deal} · {d.stage}
                          {d.address ? ` · ${d.address}` : ""}
                        </span>
                        <span className="mt-1 block text-xs font-medium text-ink">{d.headline}</span>
                        {d.words && <span className="mt-0.5 line-clamp-2 block text-xs leading-snug text-ink-2">{d.words}</span>}
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        </>
      )}
    </aside>
  );
}

/** One deal open in the pane: where it stands, the assistant's calls on it as they were said, and what to do next. */
function DealOpen({ deal, onBack, actions }: { deal: AssistantDeal; onBack: () => void; actions: React.ReactNode }) {
  const { caller } = useCallerInfo();
  const [calls, setCalls] = useState<AssistantDealCall[] | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const name = caller.name;
  const first = deal.customer.split(" ")[0] || deal.customer;

  useEffect(() => {
    let live = true;
    void loadDealCalls(deal.jobId).then((res) => {
      if (!live) return;
      if (!res.ok) return setFailed(res.message);
      setCalls(res.calls);
      setOpen(res.calls[0]?.lines.length ? res.calls[0].id : null);
    });
    return () => {
      live = false;
    };
    // Read again when a call on it ends or one is lined up.
  }, [deal.jobId, deal.calls, deal.standing]);

  const calling = deal.standing === "live" || deal.standing === "lined-up";
  return (
    <>
      <div className="border-b border-line px-4 py-3">
        <button type="button" onClick={onBack} className="flex items-center gap-1.5 text-xs font-medium text-ink-2 hover:text-ink">
          <ArrowLeft className="size-3.5" aria-hidden /> All of {name}&apos;s deals
        </button>
        <div className="mt-2 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-base font-semibold text-ink">{deal.customer}</p>
            <p className="truncate text-xs text-ink-2">
              {deal.deal} · {deal.stage}
            </p>
            {deal.address && <p className="truncate text-xs text-muted">{deal.address}</p>}
          </div>
        </div>
        <p className="mt-2 flex items-center gap-2 text-xs font-medium text-ink">
          <span className={clsx("size-2 rounded-full", DOT[deal.standing])} aria-hidden />
          {STANDING_WORDS[deal.standing]} · {deal.headline}
        </p>
        {calling && (
          <button
            type="button"
            onClick={() => watchAssistantCall({ jobId: deal.jobId, name: deal.customer, message: deal.headline })}
            className="tap-area mt-2 inline-flex items-center gap-1.5 rounded-full bg-surface px-3 py-1.5 text-xs font-semibold text-ink ring-1 ring-line hover:ring-sun-line"
          >
            <Radio className="size-3.5 text-sun-line" aria-hidden />
            {deal.standing === "live" ? "Watch the call live" : "Open the call's window"}
          </button>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
        {failed && <p className="px-1 text-xs text-danger">{failed}</p>}
        {!calls && !failed && <p className="px-1 text-xs text-muted">Loading {name}&apos;s calls…</p>}
        {calls && calls.length === 0 && (
          <p className="px-1 text-sm text-ink-2">
            {name} hasn&apos;t spoken to {first} yet.
          </p>
        )}
        <ul className="space-y-2">
          {(calls ?? []).map((c) => (
            <li key={c.id} className="rounded-xl bg-surface ring-1 ring-line">
              <button
                type="button"
                onClick={() => setOpen((o) => (o === c.id ? null : c.id))}
                aria-expanded={open === c.id}
                disabled={!c.lines.length}
                className="flex w-full items-start justify-between gap-3 px-3 py-2.5 text-left"
              >
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-ink">{c.headline}</span>
                  <span className="block text-[11px] text-muted">
                    {new Date(c.at).toLocaleString("en-AU", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}
                    {c.lines.length ? "" : " · no transcript"}
                  </span>
                  {c.words && <span className="mt-1 block text-xs leading-snug text-ink-2">{c.words}</span>}
                </span>
                {c.lines.length > 0 && (
                  <ChevronDown
                    className={clsx("mt-0.5 size-4 shrink-0 text-ink-2 transition-transform", open === c.id && "rotate-180")}
                    aria-hidden
                  />
                )}
              </button>
              {open === c.id && c.lines.length > 0 && (
                <div className="space-y-1.5 border-t border-line px-3 py-2.5">
                  {c.lines.map((l, i) => (
                    <p
                      key={i}
                      className={clsx(
                        "max-w-[88%] rounded-2xl px-3 py-1.5 text-xs leading-snug",
                        l.role === "customer" ? "ml-auto bg-sun text-ink" : "bg-surface-2 text-ink",
                      )}
                    >
                      <span className="sr-only">{l.role === "customer" ? `${first}: ` : `${name}: `}</span>
                      {l.text}
                    </p>
                  ))}
                </div>
              )}
            </li>
          ))}
        </ul>
      </div>
      <div className="bg-surface">{actions}</div>
    </>
  );
}
