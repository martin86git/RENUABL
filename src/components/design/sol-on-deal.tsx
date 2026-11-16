"use client";

/**
 * Sol's line at the top of a deal (16 Nov 2026, Martin: make Sol a more active player on the CRM page): what last
 * happened, what Sol does next (his lined-up email, counting down, with Read it and Stop), and the one thing the deal
 * needs from a person, with its button. Rules in domain/design/sol-on-deal.ts; the deal's card from the deal feed.
 */
import { useCallback, useEffect, useState } from "react";
import clsx from "clsx";
import type { MoveKind } from "@/lib/domain/design/deal-feed";
import type { FeedDeal } from "@/lib/domain/design/deal-feed";
import { solOnDeal } from "@/lib/domain/design/sol-on-deal";
import { actOnOutbox } from "@/lib/services/sol-agents";
import { loadFeedDeal } from "@/lib/services/deal-feed";
import { Countdown, ReviewSol } from "./deal-feed";
import { SolMark } from "./sol-icon";

const REFRESH_MS = 60_000;

export function SolOnDealCard(props: {
  jobId: string;
  phone: string | null;
  /** Changes when something happens on the page (a note added, a design saved), so Sol's line is read again. */
  refresh: number;
  /** The deal page acts on a move it has a place for: the chat, the designer, the proposal, the details. */
  onMove: (kind: Exclude<MoveKind, "review" | "call">) => void;
}) {
  const [deal, setDeal] = useState<FeedDeal | null>(null);
  const [now, setNow] = useState(() => new Date());
  const [reviewing, setReviewing] = useState(false);
  const [busy, setBusy] = useState(false);

  const read = useCallback(async () => {
    const r = await loadFeedDeal(props.jobId);
    if (r.ok) setDeal(r.deal);
  }, [props.jobId]);

  useEffect(() => {
    let gone = false;
    void loadFeedDeal(props.jobId).then((r) => {
      if (!gone && r.ok) setDeal(r.deal);
    });
    return () => {
      gone = true;
    };
  }, [props.jobId, props.refresh]);
  useEffect(() => {
    const tick = window.setInterval(() => setNow(new Date()), 30_000);
    const again = window.setInterval(() => {
      if (document.visibilityState === "visible") void read();
    }, REFRESH_MS);
    return () => {
      window.clearInterval(tick);
      window.clearInterval(again);
    };
  }, [read]);

  if (!deal) return null;
  const line = solOnDeal(deal, now);
  const name = deal.customer.split(/\s+/)[0] || "them";
  const quiet = "inline-flex h-8 items-center rounded-full px-3 text-[12.5px] font-medium text-ink ring-1 ring-line hover:bg-surface-2";

  const act = async (what: "hold" | "release") => {
    if (!deal.sol?.id) return;
    setBusy(true);
    await actOnOutbox(deal.sol.id, what);
    setBusy(false);
    void read();
  };

  const move = line.need?.move ?? null;
  const moveButton = move ? (
    move.kind === "call" ? (
      props.phone ? (
        <a href={`tel:${props.phone.replace(/\s+/g, "")}`} className={MOVE}>
          {move.label}
        </a>
      ) : null
    ) : (
      <button
        type="button"
        className={MOVE}
        aria-expanded={move.kind === "review" ? reviewing : undefined}
        onClick={() => (move.kind === "review" ? setReviewing((r) => !r) : props.onMove(move.kind as Exclude<MoveKind, "review" | "call">))}
      >
        {move.label}
      </button>
    )
  ) : null;

  return (
    <section aria-label="Sol on this deal" className="rounded-2xl bg-surface p-4 ring-1 ring-line sm:p-5">
      <div className="mb-3 flex items-center gap-2.5">
        <span className="sol-orb relative inline-flex size-7 shrink-0 items-center justify-center rounded-full" aria-hidden>
          <SolMark className="size-6" glow={false} />
        </span>
        <span className="text-[11.5px] font-semibold tracking-[0.08em] text-muted uppercase">Sol · on this deal</span>
      </div>

      <dl className="grid gap-x-4 gap-y-3 text-[14px] leading-relaxed sm:grid-cols-[8.5rem_minmax(0,1fr)]">
        <dt className="text-[12.5px] text-muted sm:pt-0.5">What happened</dt>
        <dd className="flex min-w-0 flex-wrap items-baseline justify-between gap-x-3 text-ink">
          <span className="min-w-0">{line.happened?.text}</span>
          {line.happened && <span className="shrink-0 text-[12px] text-muted">{line.happened.ago}</span>}
        </dd>

        <dt className="text-[12.5px] text-muted sm:pt-0.5">I&apos;ll do next</dt>
        <dd className="min-w-0 text-ink">
          {line.next && deal.sol ? (
            <>
              <p>{line.next.text}</p>
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                <span
                  className={clsx(
                    "inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-[12.5px] font-medium",
                    line.next.state === "counting" ? "text-sun-ink ring-1 ring-sun-line" : "text-ink-2 ring-1 ring-line",
                  )}
                >
                  {line.next.state === "counting" && <Countdown sol={deal.sol} now={now} />}
                  {line.next.when}
                </span>
                {move?.kind !== "review" && (
                  <button type="button" className={quiet} aria-expanded={reviewing} onClick={() => setReviewing((r) => !r)}>
                    {reviewing ? "Close" : "Read it"}
                  </button>
                )}
                {line.next.state === "counting" && (
                  <button type="button" disabled={busy} className={quiet} onClick={() => void act("hold")}>
                    Stop
                  </button>
                )}
                {line.next.state === "held" && (
                  <button type="button" disabled={busy} className={quiet} onClick={() => void act("release")}>
                    Let Sol send it
                  </button>
                )}
              </div>
            </>
          ) : (
            <p className="text-ink-2">Nothing lined up for {name} yet.</p>
          )}
        </dd>

        <dt className="text-[12.5px] text-muted sm:pt-0.5">Needs you</dt>
        <dd className="flex min-w-0 flex-wrap items-center justify-between gap-x-3 gap-y-2">
          <span className={line.need ? "text-ink" : "text-ink-2"}>{line.need ? line.need.text : "Nothing right now."}</span>
          {moveButton}
        </dd>
      </dl>

      {reviewing && deal.sol && (
        <ReviewSol
          deal={deal}
          now={now}
          onClose={() => setReviewing(false)}
          onDone={() => {
            setReviewing(false);
            void read();
          }}
        />
      )}
    </section>
  );
}

const MOVE =
  "inline-flex h-9 shrink-0 items-center whitespace-nowrap rounded-full bg-primary px-4 text-[13px] font-semibold text-primary-ink hover:brightness-125";
