"use client";

import { useEffect, useState } from "react";
import clsx from "clsx";
import { ArrowLeft, ChevronDown, Search, SquareKanban } from "lucide-react";
import {
  STANDING_WORDS,
  dealGroups,
  dealsSummary,
  DEALS_SEARCH_FROM,
  searchDeals,
  type AssistantDeal,
  type AssistantDealCall,
  type DealStanding,
} from "@/lib/domain/design/assistant-deals";
import { suburbOfAddress } from "@/lib/domain/design/deal-feed";
import { useCallerInfo } from "@/lib/services/caller";
import { loadAssistantDeals, loadDealCalls, useCoachCaller } from "@/lib/services/coaching";
import { AfterCall, CallInPane } from "./assistant-call";

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
 * each stands. **A plain list to scroll through** (Martin, the same day: "it should just list the deals without all
 * the context until you click on it and then the context opens"): each deal is one line, its customer and where it
 * stands; pressing it drops its context open under it (the deal, its calls as they were said, call back to ask, text,
 * open the deal) and the chat beside it is then about that deal; pressing it again folds it. On a phone the pane takes
 * the window's place.
 */
/** " · Solar and a battery · Rowville": what tells one customer's deals apart in the list. */
const dealTag = (d: AssistantDeal) =>
  [d.deal, suburbOfAddress(d.address)]
    .filter(Boolean)
    .map((w) => ` · ${w}`)
    .join("");

export function CoachDeals(props: { picked: AssistantDeal | null; onPick: (d: AssistantDeal | null) => void; onBack: () => void }) {
  const { callsOn, textsOn } = useCallerInfo();
  const caller = useCoachCaller();
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

  const shown = searchDeals(deals ?? [], typed);

  return (
    <aside aria-label={`${name}'s deals`} className="flex w-full shrink-0 flex-col bg-canvas sm:w-[var(--coach-pane)]">
      <button
        type="button"
        onClick={props.onBack}
        className="flex items-center gap-1.5 border-b border-line px-4 py-2.5 text-xs font-medium text-ink-2 hover:text-ink sm:hidden"
      >
        <ArrowLeft className="size-3.5" aria-hidden /> Back to the chat
      </button>
      <div className="border-b border-line bg-surface px-4 py-3">
        <p className="flex items-center gap-2 text-sm font-semibold text-ink">
          <SquareKanban className="size-4 text-sun-line" aria-hidden />
          {name}&apos;s deals
          <span className="ml-auto text-xs font-normal text-muted">{deals ? dealsSummary(deals) : "Loading…"}</span>
        </p>
        {/* One search in the window while the list is short (14 Nov 2026, Martin's tidy-up: this box beside the contact
            search read as the same thing twice); a long list gets its own. */}
        {(deals?.length ?? 0) >= DEALS_SEARCH_FROM && (
          <label className="mt-2.5 flex items-center gap-2 rounded-full bg-canvas px-3 py-1.5 ring-1 ring-line focus-within:ring-sun-line">
            <Search className="size-3.5 shrink-0 text-muted" aria-hidden />
            <input
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              placeholder="Find a customer or address"
              aria-label={`Search ${name}'s deals`}
              className="min-w-0 flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-muted"
            />
          </label>
        )}
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
            <ul className="space-y-1 px-3 pb-2">
              {g.deals.map((d) => {
                const open = picked?.jobId === d.jobId;
                return (
                  <li key={d.jobId} className={clsx("rounded-xl bg-surface ring-1 transition", open ? "ring-sun-line" : "ring-line")}>
                    <button
                      type="button"
                      onClick={() => onPick(open ? null : d)}
                      aria-expanded={open}
                      className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left hover:bg-surface-2"
                    >
                      <span className={clsx("size-2 shrink-0 rounded-full", DOT[d.standing])} aria-hidden />
                      <span className="min-w-0 flex-1 truncate text-sm">
                        <span className="font-semibold text-ink">{d.customer}</span>
                        {/* What the deal is and where, so two deals of one name read apart. */}
                        <span className="text-xs text-muted">{dealTag(d)}</span>
                      </span>
                      <span className="shrink-0 text-[11px] tabular-nums text-muted">{when(d.dueAt ?? d.at)}</span>
                      <ChevronDown className={clsx("size-4 shrink-0 text-ink-2 transition-transform", open && "rotate-180")} aria-hidden />
                    </button>
                    {open && (
                      <DealContext
                        deal={d}
                        actions={
                          <AfterCall
                            jobId={d.jobId}
                            customer={d.customer.split(" ")[0] || d.customer}
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
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>
    </aside>
  );
}

/** One deal's context, dropped open under its line: where it stands, the assistant's calls on it as they were said, and what to do next. */
function DealContext({ deal, actions }: { deal: AssistantDeal; actions: React.ReactNode }) {
  const caller = useCoachCaller();
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
    });
    return () => {
      live = false;
    };
    // Read again when a call on it ends or one is lined up.
  }, [deal.jobId, deal.calls, deal.standing]);

  const calling = deal.standing === "live" || deal.standing === "lined-up";
  return (
    <div className="border-t border-line">
      <div className="px-3 py-2.5">
        <p className="text-xs text-ink-2">
          {deal.deal} · {deal.stage}
        </p>
        {deal.address && <p className="text-xs text-muted">{deal.address}</p>}
        <p className="mt-1.5 text-xs font-medium text-ink">{deal.headline}</p>
        {deal.words && <p className="mt-0.5 text-xs leading-snug text-ink-2">{deal.words}</p>}
      </div>
      <div className="px-3 pb-2.5">
        {/* The call on now or lined up, here in the pane (Martin: part of the chat, not a window of its own). */}
        {calling && (
          <CallInPane
            jobId={deal.jobId}
            customer={first}
            waiting={`${name} ${deal.headline.charAt(0).toLowerCase()}${deal.headline.slice(1)} · in calling hours`}
            onEnded={() => window.dispatchEvent(new Event(DEALS_CHANGED))}
          />
        )}
        {calls && calls.length > 0 && (
          <p className="mb-1.5 mt-1 px-1 text-[11px] font-semibold uppercase tracking-wide text-ink-2">
            {calls.length === 1 ? "Its call" : `Its ${calls.length} calls`}
          </p>
        )}
        {failed && <p className="px-1 text-xs text-danger">{failed}</p>}
        {!calls && !failed && <p className="px-1 text-xs text-muted">Loading {name}&apos;s calls…</p>}
        {calls && calls.length === 0 && !calling && (
          <p className="px-1 text-xs text-ink-2">
            {name} hasn&apos;t spoken to {first} yet.
          </p>
        )}
        <ul className="space-y-1.5">
          {(calls ?? []).map((c) => (
            <li key={c.id} className="rounded-lg bg-canvas ring-1 ring-line">
              <button
                type="button"
                onClick={() => setOpen((o) => (o === c.id ? null : c.id))}
                aria-expanded={open === c.id}
                disabled={!c.lines.length}
                className="flex w-full items-start justify-between gap-3 px-3 py-2 text-left"
              >
                <span className="min-w-0">
                  <span className="block text-xs font-semibold text-ink">{c.headline}</span>
                  <span className="block text-[11px] text-muted">
                    {new Date(c.at).toLocaleString("en-AU", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}
                    {c.lines.length ? " · transcript" : " · no transcript"}
                  </span>
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
                  {c.words && <p className="pb-1 text-xs leading-snug text-ink-2">{c.words}</p>}
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
      <div className="border-t border-line">{actions}</div>
    </div>
  );
}
