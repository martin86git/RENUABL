"use client";

import { ArrowRight, Clock, Sun } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useRef } from "react";
import { FlowGuard } from "@/components/consumer/flow-guard";
import { FlowStep } from "@/components/consumer/flow-shell";
import { useFlow, useInstallLead } from "@/components/consumer/flow-state";
import { stepHref } from "@/components/consumer/steps";
import { MonthCalendar } from "@/components/ui/month-calendar";
import { Button, Card } from "@/components/ui/primitives";
import { formatDate } from "@/lib/domain/format";
import { earliestInstallLine, pickedInstallLine } from "@/lib/domain/flow-moments";
import { INSTALL_ARRIVAL, installDateNote } from "@/lib/domain/scheduling";
import { getAvailability, getInstaller } from "@/lib/services/consumer";

function DateScreen() {
  const router = useRouter();
  const { state, update } = useFlow();
  const lead = useInstallLead();
  const availability = useMemo(() => getAvailability(state.installerId!, lead.days), [state.installerId, lead.days]);
  const dates = useMemo(() => availability.map((a) => a.date), [availability]);
  const day = availability.find((a) => a.date === state.installDate);
  const ready = Boolean(day && state.windowId);
  const timesRef = useRef<HTMLDivElement>(null);
  const installer = state.installerId ? getInstaller(state.installerId) : undefined;
  // The reward for this step: how soon it could happen, then the day they chose.
  const moment = day ? pickedInstallLine(day.date) : earliestInstallLine(dates[0]);

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
      {day && (
        <p className="mt-3 rounded-xl bg-sage/60 px-3.5 py-2.5 text-[13px] leading-snug text-forest" role="note">
          {installDateNote(lead.solarVic)}
        </p>
      )}
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
      {moment && (
        <p
          key={moment}
          className="mb-5 flex max-w-4xl animate-fade-up items-center gap-3 rounded-2xl bg-sun px-4 py-3 text-[14.5px] text-sun-ink"
          aria-live="polite"
        >
          <Sun className="h-5 w-5 shrink-0" strokeWidth={1.7} aria-hidden /> {moment}
        </p>
      )}
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
          {lead.solarVic ? (
            <p className="text-[12.5px] text-muted">
              Dates start two weeks away, so there&apos;s time to apply for Solar Victoria&apos;s rebate and have it approved (usually 7 to
              10 business days).
            </p>
          ) : (
            <p className="text-[12.5px] text-muted">Dates start a week away, subject to installation calendar capacity.</p>
          )}
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
