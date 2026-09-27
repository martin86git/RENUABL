"use client";

import { ArrowRight, CalendarDays, Check, Gift, HeartPulse, PhoneCall, UserRound, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { CallBooking } from "@/components/consumer/call-booking";
import { FlowGuard } from "@/components/consumer/flow-guard";
import { FlowStep } from "@/components/consumer/flow-shell";
import { useFlow } from "@/components/consumer/flow-state";
import { Mascot } from "@/components/ui/brand-art";
import { ButtonLink, Card } from "@/components/ui/primitives";
import { CARE_FREE_MONTHS, CARE_PLAN, careIncludedValue, carePriceLabel } from "@/lib/domain/care";
import { formatDate } from "@/lib/domain/format";
import { getWindow } from "@/lib/domain/scheduling";
import { getInstaller } from "@/lib/services/consumer";

function Item({ icon: Icon, title, detail }: { icon: LucideIcon; title: string; detail: ReactNode }) {
  return (
    <li className="flex items-start gap-4 px-5 py-4">
      <Icon className="mt-0.5 h-6 w-6 shrink-0 text-ink" strokeWidth={1.3} aria-hidden />
      <div className="min-w-0">
        <p className="text-[14px] text-ink">{title}</p>
        {typeof detail === "string" ? <p className="text-[12.5px] leading-snug text-muted">{detail}</p> : detail}
      </div>
    </li>
  );
}

function ConfirmedScreen() {
  const { state } = useFlow();
  const installer = state.installerId ? getInstaller(state.installerId) : undefined;
  const window = state.windowId ? getWindow(state.windowId) : undefined;

  return (
    <FlowStep
      width="narrow"
      centered
      hideMobileHeader
      title={<span className="sr-only">Confirmation</span>}
      cta={
        <ButtonLink href="/my" size="lg" className="w-full lg:w-80">
          View in my account <ArrowRight className="h-[18px] w-[18px]" strokeWidth={1.6} />
        </ButtonLink>
      }
    >
      <div className="mx-auto max-w-md text-center">
        <div className="relative mx-auto w-[170px]">
          <Mascot className="h-auto w-full" float priority />
          <span className="absolute bottom-2 right-0 grid h-11 w-11 place-items-center rounded-full bg-forest text-white ring-4 ring-canvas">
            <Check className="h-5 w-5" strokeWidth={2.4} />
          </span>
        </div>
        <h2 className="mt-8 text-[34px] font-normal tracking-[-0.035em]">You&apos;re all set.</h2>
        <p className="mt-1 text-[15px] text-muted">
          Your reservation {state.reservation?.reservationId ? `${state.reservation.reservationId} ` : ""}is confirmed.
        </p>

        <Card className="mt-6 text-left">
          <ul className="divide-y divide-line">
            <Item icon={PhoneCall} title="15-minute system confirmation" detail={<CallBooking />} />
            {state.installDate && (
              <Item
                icon={CalendarDays}
                title="Provisional installation date"
                detail={`${formatDate(state.installDate, { weekday: "long", day: "numeric", month: "long", year: "numeric" })}${window ? ` · arrival ${window.label}` : ""}`}
              />
            )}
            {installer && <Item icon={UserRound} title="Matched installer" detail={installer.name} />}
            {state.reservation?.careIncluded && (
              <Item
                icon={Gift}
                title={`${CARE_FREE_MONTHS} months free ${CARE_PLAN.name}`}
                detail={`Valued at $${careIncludedValue()} · starts when your system is switched on`}
              />
            )}
            {state.reservation?.care && (
              <Item
                icon={HeartPulse}
                title={CARE_PLAN.name}
                detail={`${carePriceLabel(state.reservation.care)} · starts after your system is switched on`}
              />
            )}
          </ul>
        </Card>
      </div>
    </FlowStep>
  );
}

export default function ConfirmedPage() {
  return (
    <FlowGuard step="confirmed">
      <ConfirmedScreen />
    </FlowGuard>
  );
}
