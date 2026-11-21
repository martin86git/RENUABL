"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { markHolds, needsYou, nextMove, type FeedDeal } from "@/lib/domain/design/deal-feed";
import { PATHS } from "./design-shell";
import { openDesigner } from "./design-drawer";
import { briefHref } from "@/lib/domain/design/deal-team";
import { SolTerminal } from "./sol-on-deal";

/** The deals that need a person now, as the feed's Needs you has them (held by Done or Later left out). */
export const dealsNeedingYou = (deals: readonly FeedDeal[], now = new Date()) =>
  deals.filter((d) => needsYou(d, now) !== null && !markHolds(d, now) && nextMove(d, now) !== null);

/**
 * Needs you in Today's tray (21 Nov 2026, Martin: "i love the terminal view… that instantly contain suggestions from Sol";
 * the tray is what Sol or a voice agent can act on): each deal that needs a person, with Sol's terminal on it.
 */
export function TrayNeeds({ deals, onChanged }: { deals: FeedDeal[] | null; onChanged: () => void }) {
  const router = useRouter();
  if (!deals) return <div className="h-48 animate-pulse rounded-[22px] bg-surface/70 ring-1 ring-line/70" />;
  const now = new Date();
  const shown = dealsNeedingYou(deals, now);
  if (!shown.length)
    return <p className="rounded-2xl bg-surface px-5 py-4 text-[13.5px] text-ink-2 ring-1 ring-line/70">Nothing needs you right now.</p>;
  return (
    <div className="space-y-3">
      {shown.slice(0, 8).map((d) => {
        const deal = `${PATHS.deals}/${d.jobId}`;
        return (
          <article key={d.jobId} className="rounded-[22px] bg-surface p-4 ring-1 ring-line/70">
            <Link href={deal} className="mb-3 block min-w-0 hover:underline">
              <span className="text-[14px] font-semibold text-ink">{d.customer}</span>
              <span className="text-[13px] text-muted"> · {[d.title, d.address].filter(Boolean).join(" · ")}</span>
            </Link>
            <SolTerminal
              inCard
              openDeal={deal}
              jobId={d.jobId}
              phone={d.phone ?? null}
              deal={d}
              now={now}
              onRead={onChanged}
              onMove={(kind) => {
                const ask = d.team?.openAsks.find((a) => a.type === "design");
                if (kind === "design")
                  return openDesigner(ask ? briefHref(d.jobId, ask.id) : `${PATHS.designer}?job=${encodeURIComponent(d.jobId)}`, router);
                if (kind === "proposal") return openDesigner(`${deal}/proposal`, router);
                router.push(
                  kind === "reply"
                    ? `${deal}?tab=chat`
                    : kind === "email"
                      ? `${deal}?tab=email`
                      : kind === "approvals"
                        ? `${deal}?tab=details&section=network`
                        : kind === "book"
                          ? `${deal}?tab=details`
                          : `${deal}?tab=team`,
                );
              }}
            />
          </article>
        );
      })}
      {shown.length > 8 && <p className="px-1 text-[12.5px] text-muted">{shown.length - 8} more on your Feed.</p>}
    </div>
  );
}
