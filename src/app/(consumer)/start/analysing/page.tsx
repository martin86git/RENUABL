"use client";

import { Check } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { FlowStep } from "@/components/consumer/flow-shell";
import { useFlow } from "@/components/consumer/flow-state";
import { stepHref } from "@/components/consumer/steps";
import { cn } from "@/components/ui/primitives";
import { PLAN_ASSURANCE, PLAN_HEADLINE, planChecks, type PlanCheck } from "@/lib/domain/sources";

const STEP_MS = 1100;
/** How long to wait for NASA and the rebate rules before moving on without them. */
const WAIT_MS = 6000;

export default function AnalysingPage() {
  const router = useRouter();
  const { state, hydrated } = useFlow();
  const [done, setDone] = useState(0);
  const [waited, setWaited] = useState(false);
  const address = state.address;

  useEffect(() => {
    const t = setTimeout(() => setWaited(true), WAIT_MS);
    return () => clearTimeout(t);
  }, []);

  const sunshineReady = Boolean(
    state.sunshine &&
    address?.lat !== undefined &&
    address.lng !== undefined &&
    Math.abs(state.sunshine.lat - address.lat) < 0.01 &&
    Math.abs(state.sunshine.lng - address.lng) < 0.01,
  );
  const checks = planChecks({ address, sunshineUnavailable: waited && !sunshineReady });
  // A tick means that source's data has arrived (the rebate rules fall back to the hand-checked CER copy).
  const ready = (c: PlanCheck | undefined) =>
    !c ? false : c.id === "nasa" ? sunshineReady : c.id === "cer" || c.id === "solar-vic" ? Boolean(state.rates) || waited : true;
  const next = checks[done];
  const nextReady = ready(next);

  useEffect(() => {
    if (!hydrated) return;
    if (!address) {
      router.replace("/");
      return;
    }
    if (done >= checks.length) {
      const t = setTimeout(() => router.push(stepHref("profile")), 1000);
      return () => clearTimeout(t);
    }
    if (!nextReady) return;
    const t = setTimeout(() => setDone((d) => d + 1), STEP_MS);
    return () => clearTimeout(t);
  }, [done, hydrated, address, router, checks.length, nextReady]);

  return (
    <FlowStep width="narrow" title={PLAN_HEADLINE} subtitle={PLAN_ASSURANCE}>
      <div>
        {address && (
          <p className="mb-6 text-[14px] text-muted">
            {address.line}, {address.suburb}
          </p>
        )}
        <ul className="space-y-5" aria-live="polite">
          {checks.map((c, i) => {
            const complete = i < done;
            return (
              <li key={c.id} className="flex items-center gap-4">
                <span
                  className={cn(
                    "grid h-7 w-7 shrink-0 place-items-center rounded-full border transition-colors",
                    complete ? "border-forest bg-forest text-white" : "border-line-strong",
                  )}
                >
                  {complete && <Check className="h-4 w-4" strokeWidth={2.4} />}
                </span>
                <span className="min-w-0">
                  <span className={cn("block text-[16px] transition-colors", complete ? "text-ink" : "text-muted")}>{c.name}</span>
                  <span className="block text-[13px] text-muted">{c.detail}</span>
                </span>
              </li>
            );
          })}
        </ul>
      </div>
    </FlowStep>
  );
}
