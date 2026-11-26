"use client";

/**
 * The system the customer is looking at, kept in a slim bar at the top of their proposal once the choice of systems has
 * scrolled out of view (26 Nov 2026, Martin: "as the customer scrolls up the proposal details they are on remain in a
 * more compact top bar to always keep the option in view"). Each option is a pill to switch to; the heart likes the
 * one on show; pressing the name goes back up to the cards.
 */
import { useEffect, useState } from "react";
import clsx from "clsx";
import { ChevronUp } from "lucide-react";
import type { OptionKey, ProposalOption } from "@/lib/domain/design/proposal";
import { LikeButton } from "./proposal-view";

const dollars = (n: number) => `$${Math.round(n).toLocaleString("en-AU")}`;

export function ProposalOptionBar({
  options,
  chosen,
  onChoose,
  liked,
  onLike,
}: {
  options: ProposalOption[];
  chosen: OptionKey | null;
  onChoose?: (goal: OptionKey) => void;
  liked: readonly string[];
  onLike: (goal: OptionKey, liked: boolean) => void;
}) {
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const cards = document.getElementById("choose-system")?.closest("section");
    if (!cards) return;
    // Shown only once the cards are above the screen, never while they are below it (at the page's top).
    const seen = new IntersectionObserver(([e]) => setShown(!e.isIntersecting && e.boundingClientRect.top < 0));
    seen.observe(cards);
    return () => seen.disconnect();
  }, []);
  const on = options.find((o) => o.goal === chosen) ?? options[0];
  if (!on) return null;
  const isLiked = liked.includes(on.goal);
  const backUp = () =>
    document
      .getElementById("choose-system")
      ?.closest("section")
      ?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });

  return (
    <div
      aria-hidden={!shown}
      inert={!shown}
      className={clsx(
        "fixed inset-x-0 top-0 z-40 border-b border-line bg-surface/90 shadow-sm backdrop-blur transition-transform duration-300",
        shown ? "translate-y-0" : "-translate-y-full",
      )}
      style={{ paddingTop: "env(safe-area-inset-top)" }}
    >
      <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-2">
        <button type="button" onClick={backUp} className="flex min-w-0 flex-1 items-center gap-2 text-left" title="See all the systems">
          <span className="min-w-0">
            <span className="block truncate text-[14px] font-semibold text-ink">{on.name}</span>
            <span className="block truncate text-[12px] text-muted">
              {on.system.kw.toFixed(2)} kW{on.system.batteryKwh > 0 ? ` · ${on.system.batteryKwh} kWh` : ""} ·{" "}
              <span className="font-medium text-ink tabular-nums">{dollars(on.price.youPay)}</span>
            </span>
          </span>
          <ChevronUp className="size-4 shrink-0 text-muted" aria-hidden />
        </button>
        {onChoose && options.length > 1 && (
          <div role="radiogroup" aria-label="Systems" className="hidden shrink-0 gap-1 sm:flex">
            {options.map((o, i) => (
              <button
                key={o.goal}
                type="button"
                role="radio"
                aria-checked={o.goal === on.goal}
                onClick={() => onChoose(o.goal)}
                title={o.name}
                className={clsx(
                  "h-8 rounded-full px-3 text-[12.5px] font-medium",
                  o.goal === on.goal ? "bg-primary text-primary-ink" : "bg-surface-2 text-ink hover:bg-line",
                )}
              >
                {i + 1}
              </button>
            ))}
          </div>
        )}
        {onChoose && options.length > 1 && (
          <select
            aria-label="Systems"
            value={on.goal}
            onChange={(e) => onChoose(e.target.value as OptionKey)}
            className="h-8 shrink-0 rounded-full border border-line bg-surface px-2 text-[13px] sm:hidden"
          >
            {options.map((o, i) => (
              <option key={o.goal} value={o.goal}>
                {i + 1}. {o.name}
              </option>
            ))}
          </select>
        )}
        <LikeButton liked={isLiked} name={on.name} onClick={() => onLike(on.goal, !isLiked)} />
      </div>
    </div>
  );
}
