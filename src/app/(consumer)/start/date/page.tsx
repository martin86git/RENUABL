"use client";

import { ArrowRight, Clock } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useRef } from "react";
import { FlowGuard } from "@/components/consumer/flow-guard";
import { FlowStep } from "@/components/consumer/flow-shell";
import { useFlow } from "@/components/consumer/flow-state";
import { stepHref } from "@/components/consumer/steps";
import { MonthCalendar } from "@/components/ui/month-calendar";
import { Button, Card } from "@/components/ui/primitives";
import { formatDate } from "@/lib/domain/format";
import { INSTALL_ARRIVAL } from "@/lib/domain/scheduling";
import { getAvailability, getInstaller } from "@/lib/services/consumer";

function DateScreen() {
  const router = useRouter();
  const { state, update } = useFlow();
  const availability = useMemo(() => getAvailability(state.installerId!), [state.installerId]);
  const dates = useMemo(() => availability.map((a) => a.date), [availability]);
  const day = availability.find((a) => a.date === state.installDate);
  const ready = Boolean(day && state.windowId);
  const timesRef = useRef<HTMLDivElement>(null);
  const installer = state.installerId ? getInstaller(state.installerId) : undefined;

  const arrival = (
    <div ref={timesRef} className="rounded-[var(--radius-card)] bg-surface p-5 shadow-[var(--shadow-soft)]" aria-live="polite">
      <div className="flex items-start gap-3">
        <Clock className="mt-0.5 h-5 w-5 shrink-0 text-forest" strokeWidth={1.6} aria-hidden />
        <div>
          <p className="text-[15px] text-ink">
            {day ? formatDate(day.date, { weekday: "long", day: "numeric", month: "long" }) : "Pick a date"}
          </p>
          <p className="mt-0.5 text-[13.5px] text-muted">
            Estimated arrival <span className="font-medium text-ink">{INSTALL_ARRIVAL.label}</span>
          </p>
        </div>
      </div>
      <p className="mt-3 text-[12.5px] leading-snug text-muted">
        Your installation partner will text you when they&apos;re on the way. Most installs are finished the same day.
      </p>
    </div>
  );

  return (
    <FlowStep
      width="wide"
      title="Select your installation date."
      subtitle={`Choose the day that suits you with ${installer ? installer.name : "your matched installer"}.`}
      cta={
        <Button size="lg" className="w-full lg:w-72" disabled={!ready} onClick={() => router.push(stepHref("reserve"))}>
          Continue <ArrowRight className="h-[18px] w-[18px]" strokeWidth={1.6} />
        </Button>
      }
    >
      <div className="grid max-w-4xl grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,340px)]">
        <Card className="p-5">
          <MonthCalendar
            available={dates}
            value={state.installDate}
            onChange={(installDate) => {
              update({ installDate, windowId: INSTALL_ARRIVAL.id });
              // On stacked (mobile) layouts, bring the arrival details into view next.
              if (typeof matchMedia !== "undefined" && !matchMedia("(min-width: 1024px)").matches) {
                timesRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
              }
            }}
          />
        </Card>
        <div className="space-y-5">
          {arrival}
          <p className="text-[12.5px] text-muted">Reschedule free up to 72 hours before.</p>
        </div>
      </div>
    </FlowStep>
  );
}

export default function DatePage() {
  return (
    <FlowGuard step="date">
      <DateScreen />
    </FlowGuard>
  );
}
