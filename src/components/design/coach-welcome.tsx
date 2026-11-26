"use client";

import { useEffect, useState, type ReactNode } from "react";
import { ChevronRight, MessageSquare, PhoneCall, X } from "lucide-react";
import { callsToday, callsTodayWords, type AssistantDeal } from "@/lib/domain/design/assistant-deals";
import { chatDayWords, type CoachChatLine } from "@/lib/domain/design/coach-threads";
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
 * beside the chat. Under them, how many of its deals need a person, then **the chats** (14 Nov 2026, Martin: "I need it
 * to start a new chat thread, and I should be able to find previous chat threads"): the latest to carry on, and the
 * earlier ones to open again. Typing in the box below starts a new chat.
 */
/** How many chats show before Show all. */
const CHATS_SHOWN = 4;

export function CoachWelcome(props: {
  caller: CallerState;
  /** The chat going, when something has been said in it. */
  current: Omit<CoachChatLine, "id"> | null;
  /** The chats before it, newest first. */
  past: CoachChatLine[];
  onOpenChat: (id: string) => void;
  /** Forget an earlier chat; absent for someone who can't coach the assistant. */
  onForgetChat?: (id: string) => void;
  onPick: (deal: AssistantDeal) => void;
  onDeals: () => void;
  onTalk: () => void;
  /** The chat box, floating under the agent as on Today (26 Nov 2026, Martin). */
  box?: ReactNode;
}) {
  const { caller } = props;
  const name = caller.name;
  const [deals, setDeals] = useState<AssistantDeal[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [allChats, setAllChats] = useState(false);

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
  const now = new Date();
  const room = CHATS_SHOWN - (props.current ? 1 : 0);
  const pastShown = allChats ? props.past : props.past.slice(0, room);
  // Compact rows in the look of Sol's opening (26 Nov 2026, Martin: "make the chats smaller"; "be influenced by the
  // cards on sol drawer chat"): white cards on a fine line, a graphite round with an orange mark, an orange ring on hover.
  const chatRow =
    "flex w-full items-center gap-2.5 rounded-xl bg-surface px-2.5 py-1.5 text-left text-[13px] text-ink-2 ring-1 ring-line transition hover:text-ink hover:ring-sun-line";
  const mark = "grid size-6 shrink-0 place-items-center rounded-full bg-primary text-sun-line";
  const head = "px-1 font-mono text-[10px] uppercase tracking-[0.14em] text-muted";

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col px-1 py-3">
      {/* The agent large in the middle, its day under it, and the box floating below, as on Today (26 Nov 2026,
          Martin: "i prefer having a large voice agent icon in the middle. with also the chat box floating underneath"). */}
      <div className="flex flex-col items-center pt-4 text-center">
        <CallerAvatar caller={caller} size={88} />
        <p className="mt-3 text-[24px] font-light leading-tight tracking-tight text-ink">What&apos;s next for {name}?</p>
        <p className="mt-1 text-[13px] text-muted">
          {!deals && !failed ? "Looking at today's calls…" : (callsTodayWords(today) ?? "No calls lined up for today")}
        </p>
      </div>
      {props.box && <div className="mt-5 w-full rounded-3xl bg-surface p-2.5 shadow-lift ring-1 ring-line">{props.box}</div>}
      {today.length > 0 && <p className="mt-5 px-1 font-mono text-[10px] uppercase tracking-[0.14em] text-muted">Today</p>}

      {today.length > 0 && (
        <ol aria-label={`${name}'s calls today, in the order they ring`} className="mt-1.5 w-full space-y-1 text-left">
          {today.map((d) => (
            <li key={d.jobId}>
              <button
                type="button"
                onClick={() => props.onPick(d)}
                className="flex w-full items-center gap-2.5 rounded-xl bg-surface px-2.5 py-1.5 ring-1 ring-line transition hover:ring-sun-line"
              >
                <span className="w-14 shrink-0 font-mono text-[11px] tabular-nums text-ink">
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
                  <span className="block truncate text-[13px] font-medium text-ink">{d.customer}</span>
                  <span className="block truncate text-[11px] text-muted">
                    {d.deal} · {d.headline}
                  </span>
                </span>
                <ChevronRight className="size-4 shrink-0 text-ink-2" aria-hidden />
              </button>
            </li>
          ))}
        </ol>
      )}

      <div className="mt-2 flex w-full flex-col gap-1">
        {needs > 0 && (
          <button
            type="button"
            onClick={props.onDeals}
            className="flex items-center gap-2.5 rounded-xl bg-surface px-2.5 py-1.5 text-left text-[13px] text-ink ring-1 ring-line transition hover:ring-sun-line"
          >
            <span className={mark}>
              <PhoneCall className="size-3.5" aria-hidden />
            </span>
            <span className="flex-1">
              <strong className="font-semibold">{needs}</strong> {needs === 1 ? "deal needs" : "deals need"} you after {name}&apos;s call
            </span>
            <ChevronRight className="size-4 shrink-0 text-ink-2" aria-hidden />
          </button>
        )}
      </div>

      {(props.current || props.past.length > 0) && (
        <section aria-label={`Your chats with ${name}`} className="mt-4 w-full text-left">
          <p className={head}>Chats</p>
          <ul className="mt-1.5 space-y-1">
            {props.current && (
              <li>
                <button type="button" onClick={props.onTalk} className={chatRow}>
                  <span className={mark}>
                    <MessageSquare className="size-3.5" aria-hidden />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium text-ink">{props.current.title}</span>
                    <span className="block text-[11px] text-muted">
                      Latest · {chatDayWords(props.current.endedAt, now, LAUNCH_MARKET.timeZone)}
                    </span>
                  </span>
                  <span className="shrink-0 font-mono text-[10px] uppercase tracking-wider text-sun-line">Carry on</span>
                  <ChevronRight className="size-4 shrink-0" aria-hidden />
                </button>
              </li>
            )}
            {pastShown.map((c) => (
              <li key={c.id} className="group relative">
                <button type="button" onClick={() => props.onOpenChat(c.id)} className={chatRow}>
                  <span className={mark}>
                    <MessageSquare className="size-3.5" aria-hidden />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-ink">{c.title}</span>
                    <span className="block text-[11px] text-muted">
                      {chatDayWords(c.endedAt, now, LAUNCH_MARKET.timeZone)} · {c.count} {c.count === 1 ? "message" : "messages"}
                    </span>
                  </span>
                  <ChevronRight
                    className={
                      props.onForgetChat ? "size-4 shrink-0 group-hover:invisible group-focus-within:invisible" : "size-4 shrink-0"
                    }
                    aria-hidden
                  />
                </button>
                {props.onForgetChat && (
                  <button
                    type="button"
                    onClick={() => props.onForgetChat?.(c.id)}
                    aria-label={`Forget the chat: ${c.title}`}
                    title="Forget this chat"
                    className="absolute right-2 top-1/2 hidden size-7 -translate-y-1/2 place-items-center rounded-full bg-surface text-muted ring-1 ring-line hover:text-danger group-focus-within:grid group-hover:grid"
                  >
                    <X className="size-3.5" aria-hidden />
                  </button>
                )}
              </li>
            ))}
          </ul>
          {!allChats && props.past.length > pastShown.length && (
            <button
              type="button"
              onClick={() => setAllChats(true)}
              className="mt-1.5 px-1 py-1 text-xs font-medium text-ink-2 hover:text-ink"
            >
              Show all {props.past.length + (props.current ? 1 : 0)} chats
            </button>
          )}
          <p className="mt-2 px-1 text-[11px] text-muted">Type above to start a new chat.</p>
        </section>
      )}
    </div>
  );
}
