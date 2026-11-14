"use client";

import { useEffect, useState } from "react";
import { ChevronRight, MessageSquare, PhoneCall } from "lucide-react";
import { callsToday, callsTodayWords, type AssistantDeal } from "@/lib/domain/design/assistant-deals";
import { LAUNCH_MARKET, todayInMarket } from "@/lib/domain/market";
import type { CallerState } from "@/lib/services/caller";
import { loadAssistantDeals } from "@/lib/services/coaching";
import { CallerAvatar } from "./settings-caller";

const DEALS_CHANGED = "renuabl:assistant-deals";

/** When a call rings, in the market's own time: "2:30 pm". */
const timeOf = (iso: string) =>
  new Date(iso).toLocaleTimeString("en-AU", { hour: "numeric", minute: "2-digit", timeZone: LAUNCH_MARKET.timeZone });

/**
 * Where the assistant's window lands when it is opened (14 Nov 2026, Martin: "he needs a welcome landing rather than
 * just opening up to the last conversation… a list of his scheduled calls for today… in chronological order of
 * time"). Its calls for today, the one on now first and then by the time each rings; pressing one opens that deal
 * beside the chat. Under them, how many of its deals need a person, and the way back into the conversation. Typing in
 * the box below carries on the conversation as before.
 */
export function CoachWelcome(props: {
  caller: CallerState;
  /** Whether there is an earlier conversation to go back to. */
  hasTalk: boolean;
  onPick: (deal: AssistantDeal) => void;
  onDeals: () => void;
  onTalk: () => void;
}) {
  const { caller } = props;
  const name = caller.name;
  const [deals, setDeals] = useState<AssistantDeal[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let live = true;
    const read = () =>
      void loadAssistantDeals().then((res) => {
        if (!live) return;
        if (!res.ok) return setFailed(true);
        setFailed(false);
        setDeals(res.deals);
      });
    read();
    window.addEventListener(DEALS_CHANGED, read);
    return () => {
      live = false;
      window.removeEventListener(DEALS_CHANGED, read);
    };
  }, []);

  const today = deals ? callsToday(deals, new Date(), todayInMarket) : [];
  const needs = (deals ?? []).filter((d) => d.standing === "needs-you").length;

  return (
    <div className="mx-auto flex w-full max-w-md flex-col items-center px-2 py-4 text-center">
      <CallerAvatar caller={caller} size={56} />
      <p className="mt-3 text-lg font-semibold text-ink">{name}&apos;s day</p>
      <p className="text-xs text-muted">
        {!deals && !failed ? "Looking at today's calls…" : (callsTodayWords(today) ?? "No calls lined up for today")}
      </p>

      {today.length > 0 && (
        <ol aria-label={`${name}'s calls today, in the order they ring`} className="mt-4 w-full space-y-1.5 text-left">
          {today.map((d) => (
            <li key={d.jobId}>
              <button
                type="button"
                onClick={() => props.onPick(d)}
                className="flex w-full items-center gap-3 rounded-xl bg-canvas px-3 py-2.5 ring-1 ring-line transition hover:ring-sun-line"
              >
                <span className="w-16 shrink-0 text-xs font-semibold tabular-nums text-ink">
                  {d.standing === "live" ? (
                    <span className="inline-flex items-center gap-1 text-sun-line">
                      <span className="size-1.5 animate-pulse rounded-full bg-sun-line motion-reduce:animate-none" aria-hidden />
                      On now
                    </span>
                  ) : d.dueAt ? (
                    timeOf(d.dueAt)
                  ) : (
                    "Today"
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-ink">{d.customer}</span>
                  <span className="block truncate text-xs text-ink-2">
                    {d.deal} · {d.headline}
                  </span>
                </span>
                <ChevronRight className="size-4 shrink-0 text-ink-2" aria-hidden />
              </button>
            </li>
          ))}
        </ol>
      )}

      <div className="mt-4 flex w-full flex-col gap-1.5">
        {needs > 0 && (
          <button
            type="button"
            onClick={props.onDeals}
            className="flex items-center gap-2 rounded-xl bg-canvas px-3 py-2.5 text-left text-sm text-ink ring-1 ring-line transition hover:ring-sun-line"
          >
            <PhoneCall className="size-4 shrink-0 text-danger" aria-hidden />
            <span className="flex-1">
              <strong className="font-semibold">{needs}</strong> {needs === 1 ? "deal needs" : "deals need"} you after {name}&apos;s call
            </span>
            <ChevronRight className="size-4 shrink-0 text-ink-2" aria-hidden />
          </button>
        )}
        {props.hasTalk && (
          <button
            type="button"
            onClick={props.onTalk}
            className="flex items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm text-ink-2 ring-1 ring-line transition hover:text-ink hover:ring-sun-line"
          >
            <MessageSquare className="size-4 shrink-0" aria-hidden />
            <span className="flex-1">Carry on our conversation</span>
            <ChevronRight className="size-4 shrink-0" aria-hidden />
          </button>
        )}
      </div>
    </div>
  );
}
