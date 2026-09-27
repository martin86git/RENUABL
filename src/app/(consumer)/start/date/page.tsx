"use client";

import { CalendarCheck } from "lucide-react";
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
import { getAvailability } from "@/lib/services/consumer";

function DateScreen() {
  const router = useRouter();
  const { state, update } = useFlow();
  const availability = useMemo(() => getAvailability(state.installerId!), [state.installerId]);
  const dates = useMemo(() => availability.map((a) => a.date), [availability]);
  const day = availability.find((a) => a.date === state.installDate);
  const window = state.windowId ? getWindow(state.windowId) : undefined;
  const ready = Boolean(day && window && day.windows.includes(window.id));
  const windowsRef = useRef<HTMLDivElement>(null);

  const summary = (
    <div className="flex items-center gap-3">
      <CalendarCheck className="h-5 w-5 shrink-0 text-muted" aria-hidden />
      <p className="text-[15px]" aria-live="polite">
        {day ? (
          <>
            <span className="font-semibold">{formatDate(day.date)}</span>
            {ready && window ? (
              <span className="text-muted"> · arrival {window.label}</span>
            ) : (
              <span className="text-muted"> · choose an arrival time</span>
            )}
          </>
        ) : (
          <span className="text-muted">Choose a date that suits you</span>
        )}
      </p>
    </div>
  );

  return (
    <FlowStep
      title="When would you like it installed?"
      subtitle="Most installs take a single day. Dots show days your installer is available."
      wide
      cta={
        <div className="space-y-3 lg:flex lg:items-center lg:gap-6 lg:space-y-0">
          <div className="lg:hidden">{summary}</div>
          <Button size="lg" className="w-full lg:w-auto" disabled={!ready} onClick={() => router.push(stepHref("reserve"))}>
            Continue
          </Button>
        </div>
      }
    >
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <Card className="p-5 sm:p-6 lg:col-span-7 xl:col-span-6">
          <MonthCalendar
            available={dates}
            value={state.installDate}
            onChange={(installDate) => {
              const next = availability.find((a) => a.date === installDate);
              update({ installDate, windowId: next?.windows.includes(state.windowId ?? "") ? state.windowId : null });
              // On stacked (mobile) layouts, bring the arrival times into view next.
              if (typeof matchMedia !== "undefined" && !matchMedia("(min-width: 1024px)").matches) {
                windowsRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
              }
            }}
          />
        </Card>
        <div ref={windowsRef} className="space-y-4 lg:col-span-5 xl:col-span-4">
          <Card className="p-5 sm:p-6">
            <p className="text-[15px] font-semibold">Arrival time</p>
            <p className="mt-0.5 text-[13px] text-muted">{day ? formatDate(day.date) : "Pick a date first"}</p>
            <div className="mt-4 grid grid-cols-1 gap-2" role="radiogroup" aria-label="Arrival window">
              {INSTALL_WINDOWS.map((w) => {
                const open = Boolean(day?.windows.includes(w.id));
                const selected = state.windowId === w.id && open;
                return (
                  <button
                    key={w.id}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    disabled={!open}
                    onClick={() => update({ windowId: w.id })}
                    className={cn(
                      "flex h-14 items-center justify-between rounded-full border px-5 text-[15px] transition",
                      selected ? "border-ink bg-ink text-canvas" : "border-line bg-surface hover:border-line-strong",
                      !open && "opacity-35",
                    )}
                  >
                    <span className="font-medium">{w.label}</span>
                    <span className={cn("text-[13px]", selected ? "text-canvas/70" : "text-muted")}>{open ? w.detail : "Unavailable"}</span>
                  </button>
                );
              })}
            </div>
          </Card>
          <Card className="hidden p-5 lg:block">{summary}</Card>
          <p className="px-1 text-[13px] text-muted">You can reschedule for free up to 72 hours before your install.</p>
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
