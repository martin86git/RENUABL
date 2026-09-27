"use client";

import { Check } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { FlowStep } from "@/components/consumer/flow-shell";
import { useFlow } from "@/components/consumer/flow-state";
import { stepHref } from "@/components/consumer/steps";
import { cn } from "@/components/ui/primitives";
import { ANALYSIS_STEPS } from "@/lib/services/consumer";

const STEP_MS = 650;

export default function AnalysingPage() {
  const router = useRouter();
  const { state, hydrated } = useFlow();
  const [done, setDone] = useState(0);

  useEffect(() => {
    if (!hydrated) return;
    if (!state.address) {
      router.replace("/");
      return;
    }
    if (done >= ANALYSIS_STEPS.length) {
      const t = setTimeout(() => router.push(stepHref("profile")), 450);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => setDone((d) => d + 1), STEP_MS);
    return () => clearTimeout(t);
  }, [done, hydrated, state.address, router]);

  return (
    <FlowStep
      width="narrow"
      title={
        <>
          Setting up
          <br />
          your plan.
        </>
      }
      subtitle={state.address ? `${state.address.line}, ${state.address.suburb}` : undefined}
    >
      <div>
        <ul className="space-y-5" aria-live="polite">
          {ANALYSIS_STEPS.map((label, i) => {
            const complete = i < done;
            return (
              <li key={label} className={cn("flex items-center gap-4 text-[16px] transition-colors", complete ? "text-ink" : "text-muted")}>
                <span
                  className={cn(
                    "grid h-7 w-7 shrink-0 place-items-center rounded-full border transition-colors",
                    complete ? "border-forest bg-forest text-white" : "border-line-strong",
                  )}
                >
                  {complete && <Check className="h-4 w-4" strokeWidth={2.4} />}
                </span>
                {label}
              </li>
            );
          })}
        </ul>
      </div>
    </FlowStep>
  );
}
