"use client";

/**
 * The business's design credits as a small chip (16 Nov 2026, Martin): how many credits are left, and the free trial
 * sites while the first month lasts. Pressing it opens Settings → Billing, where the owner buys more. Low (under a
 * battery site) it turns to the warning colour and says so. Shared by the whole business.
 */
import { useEffect, useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import { Gem } from "lucide-react";
import { BATTERY_SITE_CREDITS, designBalanceWords } from "@/lib/domain/design/plans";
import { loadDesignCredits, type DesignCredits as Credits } from "@/lib/services/billing";

/** Told by any screen that just used or bought credits. */
export const CREDITS_EVENT = "renuabl:design-credits";

export function DesignCredits({ className }: { className?: string }) {
  const [state, setState] = useState<Credits | null>(null);
  useEffect(() => {
    let live = true;
    const load = () => void loadDesignCredits().then((c) => live && setState(c));
    load();
    window.addEventListener(CREDITS_EVENT, load);
    window.addEventListener("focus", load);
    return () => {
      live = false;
      window.removeEventListener(CREDITS_EVENT, load);
      window.removeEventListener("focus", load);
    };
  }, []);
  if (!state) return null;
  const trialLeft = state.trial.left;
  const low = trialLeft === 0 && state.credits < BATTERY_SITE_CREDITS;
  const title = [
    trialLeft > 0 ? `${trialLeft} free trial ${trialLeft === 1 ? "site" : "sites"} left` : null,
    designBalanceWords(state.credits),
    low ? "Not enough for a battery site" : null,
    state.owner ? "Press to buy credits" : "Shared by everyone in the business",
  ]
    .filter(Boolean)
    .join(" · ");
  return (
    <Link
      href="/design/settings/billing"
      title={title}
      aria-label={title}
      className={clsx(
        "inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-[12px] font-medium tabular-nums ring-1 transition-colors",
        low ? "bg-surface text-danger ring-danger/40" : "bg-surface text-ink ring-line hover:ring-ink/30",
        className,
      )}
    >
      <Gem className={clsx("size-3.5", low ? "text-danger" : "text-sun-line")} aria-hidden />
      {trialLeft > 0 ? (
        <span>
          {trialLeft} free {trialLeft === 1 ? "site" : "sites"}
          {state.credits > 0 ? ` · ${state.credits} credits` : ""}
        </span>
      ) : (
        <span>{state.credits} credits</span>
      )}
    </Link>
  );
}
