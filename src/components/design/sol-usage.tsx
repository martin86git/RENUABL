"use client";

/**
 * Sol's usage this month (16 Nov 2026, Martin: "we're going to need a way of seeing his consumption… a pop up window
 * showing the usage (similar to Claude)", Grok's by source): a small meter in his chat's header, opening a window with
 * the month's credits used, when they come back, the credits bought still left, where they went, and whether credits
 * top up by themselves. The business's credits, shared by everyone in it. Read again each time it opens.
 */
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import { X } from "lucide-react";
import { SOL_USE_WORDS, type SolUse } from "@/lib/domain/design/sol-credits";
import { loadSolUsage, type SolUsageView } from "@/lib/services/billing";

const day = (iso: string) => new Date(`${iso}T00:00:00`).toLocaleDateString("en-AU", { day: "numeric", month: "long" });

/** The share of the month's credits used, 0 to 1; null with none included. */
const usedShare = (u: SolUsageView) => (u.balance.included > 0 ? Math.min(1, u.balance.usedIncluded / u.balance.included) : null);

export function SolUsage() {
  const [open, setOpen] = useState(false);
  const [usage, setUsage] = useState<SolUsageView | null>(null);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    void loadSolUsage().then(setUsage);
  }, [open]);
  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => !box.current?.contains(e.target as Node) && setOpen(false);
    const key = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", away);
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("mousedown", away);
      document.removeEventListener("keydown", key);
    };
  }, [open]);
  if (!usage) return null;
  const share = usedShare(usage);
  const pct = share === null ? null : Math.round(share * 100);
  const total = usage.uses.reduce((n, u) => n + u.credits, 0);
  return (
    <div ref={box} className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-label="Sol's usage this month"
        title="Sol's usage this month"
        className={clsx(
          "inline-flex h-7 items-center gap-1.5 rounded-full px-2 text-xs tabular-nums transition-colors hover:bg-canvas",
          open ? "text-ink" : "text-muted hover:text-ink",
        )}
      >
        <span className="relative h-1.5 w-8 overflow-hidden rounded-full bg-line" aria-hidden>
          <span className="absolute inset-y-0 left-0 rounded-full bg-sun-line" style={{ width: `${pct ?? 0}%` }} />
        </span>
        {pct === null ? `${usage.balance.left.toLocaleString("en-AU")} left` : `${pct}%`}
      </button>
      {open && (
        <div
          role="dialog"
          aria-label="Sol's usage this month"
          className="sol-ground absolute right-0 top-9 z-30 w-80 space-y-4 rounded-xl p-4 shadow-xl ring-1 ring-line"
        >
          <div className="flex items-start justify-between gap-3">
            <p className="text-sm font-semibold text-ink">Sol&apos;s usage</p>
            <button type="button" onClick={() => setOpen(false)} aria-label="Close" className="text-muted hover:text-ink">
              <X className="size-4" aria-hidden />
            </button>
          </div>
          {pct !== null && (
            <div className="space-y-1.5">
              <p className="text-ink">
                <span className="text-2xl font-semibold tabular-nums">{pct}%</span>{" "}
                <span className="text-sm text-muted">of this month&apos;s credits used</span>
              </p>
              <div className="h-1.5 overflow-hidden rounded-full bg-line" aria-hidden>
                <div className="h-full rounded-full bg-sun-line" style={{ width: `${pct}%` }} />
              </div>
              <p className="text-xs text-muted">
                {usage.balance.usedIncluded.toLocaleString("en-AU")} of {usage.balance.included.toLocaleString("en-AU")} · back on{" "}
                {day(usage.resetsOn)}
              </p>
            </div>
          )}
          <p className="text-xs text-muted">
            {usage.balance.bought > 0
              ? `${usage.balance.bought.toLocaleString("en-AU")} bought credits left, used once the month's are gone.`
              : "No bought credits left."}{" "}
            Shared by everyone in your business.
          </p>
          {usage.uses.length > 0 && total > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium uppercase tracking-wide text-muted">By source</p>
              <div className="flex h-1.5 overflow-hidden rounded-full bg-line" aria-hidden>
                {usage.uses.map((u, i) => (
                  <span
                    key={u.use}
                    className={clsx("h-full", i % 2 === 0 ? "bg-sun-line" : "bg-sun-line/50")}
                    style={{ width: `${(u.credits / total) * 100}%` }}
                  />
                ))}
              </div>
              <ul className="space-y-1 text-sm">
                {usage.uses.map((u) => (
                  <li key={u.use} className="flex justify-between gap-3">
                    <span className="text-ink-2">{SOL_USE_WORDS[u.use as SolUse] ?? u.use}</span>
                    <span className="tabular-nums text-ink">
                      {u.credits.toLocaleString("en-AU")} <span className="text-muted">credits</span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <p className="text-xs text-muted">
            <span className={usage.topUp.on ? "text-ink" : undefined}>Top up by itself: </span>
            {usage.topUp.words}
          </p>
          <p className="text-xs text-muted">Calls, texts and voice agents will show here once they&apos;re counted.</p>
          {usage.owner ? (
            <Link href="/design/settings/billing#sol-credits" className="inline-block text-xs font-medium text-sun-line hover:underline">
              Credits and top-ups in Billing
            </Link>
          ) : (
            <p className="text-xs text-muted">The owner adds credits in Billing.</p>
          )}
        </div>
      )}
    </div>
  );
}
