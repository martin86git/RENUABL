"use client";

import { ArrowRight, CalendarDays } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useRef } from "react";
import { FlowGuard } from "@/components/consumer/flow-guard";
import { FlowStep } from "@/components/consumer/flow-shell";
import { useFlow } from "@/components/consumer/flow-state";
import { stepHref } from "@/components/consumer/steps";
import { MonthCalendar } from "@/components/ui/month-calendar";
import { Button, Card, cn } from "@/components/ui/primitives";
import { formatDate } from "@/lib/domain/format";
import { INSTALL_WINDOWS, getWindow } from "@/lib/domain/scheduling";
import { getAvailability, getInstaller } from "@/lib/services/consumer";

function DateScreen() {
  const router = useRouter();
  const { state, update } = useFlow();
  const availability = useMemo(() => getAvailability(state.installerId!), [state.installerId]);
  const dates = useMemo(() => availability.map((a) => a.date), [availability]);
  const day = availability.find((a) => a.date === state.installDate);
  const window = state.windowId ? getWindow(state.windowId) : undefined;
  const ready = Boolean(day && window && day.windows.includes(window.id));
  const timesRef = useRef<HTMLDivElement>(null);
  const installer = state.installerId ? getInstaller(state.installerId) : undefined;

  const times = (
    <div ref={timesRef}>
      <div className="flex items-baseline justify-between">
        <p className="text-[15px] text-ink">Available times</p>
        <p className="text-[12.5px] text-muted">
          {day ? formatDate(day.date, { weekday: "long", day: "numeric", month: "long" }) : "Pick a date first"}
        </p>
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2" role="radiogroup" aria-label="Arrival time">
        {INSTALL_WINDOWS.filter((w) => day?.windows.includes(w.id)).map((w) => {
          const selected = state.windowId === w.id;
          return (
            <button
              key={w.id}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => update({ windowId: w.id })}
              className={cn(
                "h-10 rounded-full text-[13.5px] tabular-nums transition",
                selected
                  ? "bg-primary text-primary-ink"
                  : "bg-surface text-ink-2 shadow-[0_0_0_1px_var(--line)] hover:shadow-[0_0_0_1px_var(--line-strong)]",
              )}
            >
              {w.label}
            </button>
          );
        })}
      </div>
    </div>
  );

  return (
    <FlowStep
      title="Select your installation date."
      subtitle={`Choose a date that works for you with ${installer ? installer.name : "your matched installer"}.`}
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
              const next = availability.find((a) => a.date === installDate);
              update({ installDate, windowId: next?.windows.includes(state.windowId ?? "") ? state.windowId : null });
              // On stacked (mobile) layouts, bring the times into view next.
              if (typeof matchMedia !== "undefined" && !matchMedia("(min-width: 1024px)").matches) {
                timesRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
              }
            }}
          />
        </Card>
        <div className="space-y-5">
          {times}
          <div
            className="hidden items-center gap-3 rounded-[var(--radius-card)] bg-surface p-4 shadow-[var(--shadow-soft)] lg:flex"
            aria-live="polite"
          >
            <CalendarDays className="h-5 w-5 shrink-0 text-muted" strokeWidth={1.5} />
            <p className="text-[13.5px]">
              {day ? formatDate(day.date, { weekday: "short", day: "numeric", month: "short", year: "numeric" }) : "No date selected"}
              {ready && window && <span className="text-muted"> · {window.label} arrival</span>}
            </p>
          </div>
          <p className="text-[12.5px] text-muted">Most installs take a single day. Reschedule free up to 72 hours before.</p>
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
