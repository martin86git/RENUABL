"use client";

import { ArrowRight, CalendarDays, Check, Gift, HeartPulse, Lock, Mail, PhoneCall, UserRound, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { AddToCalendar } from "@/components/consumer/add-to-calendar";
import { CallBooking } from "@/components/consumer/call-booking";
import { FlowGuard } from "@/components/consumer/flow-guard";
import { FlowStep } from "@/components/consumer/flow-shell";
import { useFlow } from "@/components/consumer/flow-state";
import { PortalTeaser } from "@/components/consumer/portal-preview";
import { Mascot } from "@/components/ui/brand-art";
import { ButtonLink, Card } from "@/components/ui/primitives";
import { callEvent, installEvent } from "@/lib/domain/calendar";
import { CARE_ENABLED, CARE_FREE_MONTHS, CARE_PLAN, careIncludedValue, carePriceLabel } from "@/lib/domain/care";
import { formatCurrency, formatDate } from "@/lib/domain/format";
import { getWindow } from "@/lib/domain/scheduling";
import { formatAddress } from "@/lib/mock/addresses";
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
  const reference = state.reservation?.reservationId ?? "RENUABL";

  return (
    <FlowStep
      width="narrow"
      centered
      hideMobileHeader
      title={<span className="sr-only">Confirmation</span>}
      cta={
        <ButtonLink href="/my" size="lg" className="w-full lg:w-80">
          Preview your RENUABL home <ArrowRight className="h-[18px] w-[18px]" strokeWidth={1.6} />
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
          {state.contact?.firstName ? `Thanks, ${state.contact.firstName}. ` : ""}Your date is reserved
          {state.reservation?.reservationId ? ` (${state.reservation.reservationId})` : ""}.
        </p>

        <Card className="mt-6 text-left">
          <ul className="divide-y divide-line">
            <Item
              icon={PhoneCall}
              title="15-minute system confirmation"
              detail={
                <>
                  <CallBooking />
                  {state.call && (
                    <AddToCalendar
                      event={callEvent({ reference, date: state.call.date, time: state.call.time })}
                      filename="renuabl-call.ics"
                    />
                  )}
                </>
              }
            />
            {state.installDate && (
              <Item
                icon={CalendarDays}
                title="Provisional installation date"
                detail={
                  <>
                    <p className="text-[12.5px] leading-snug text-muted">
                      {formatDate(state.installDate, { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
                      {window ? ` · arrival ${window.label}` : ""}
                    </p>
                    <AddToCalendar
                      event={installEvent({
                        reference,
                        date: state.installDate,
                        installer: installer?.name,
                        address: state.address ? formatAddress(state.address) : undefined,
                      })}
                      filename="renuabl-installation.ics"
                    />
                  </>
                }
              />
            )}
            {installer && <Item icon={UserRound} title="Matched installer" detail={installer.name} />}
            {state.reservation && (
              <Item
                icon={Lock}
                title="Lock in your date"
                detail={`After your call we'll text and email a secure link for the ${formatCurrency(state.reservation.depositAfterCall)} refundable deposit.`}
              />
            )}
            {state.reservation?.emailed && state.contact?.email && (
              <Item
                icon={Mail}
                title="Order summary sent"
                detail={`We've emailed your order and price breakdown to ${state.contact.email}.`}
              />
            )}
            {state.reservation?.careIncluded && (
              <Item
                icon={Gift}
                title={`${CARE_FREE_MONTHS} months free ${CARE_PLAN.name}`}
                detail={`Valued at $${careIncludedValue()} · starts when your system is switched on`}
              />
            )}
            {CARE_ENABLED && state.reservation?.care && (
              <Item
                icon={HeartPulse}
                title={CARE_PLAN.name}
                detail={`${carePriceLabel(state.reservation.care)} · starts after your system is switched on`}
              />
            )}
          </ul>
        </Card>

        <div className="mt-8 text-left">
          <p className="text-[15px] text-ink">After your system is switched on</p>
          <p className="mb-3 mt-0.5 text-[13px] text-muted">
            Here&apos;s what you can expect in My RENUABL. We&apos;ll show you around on your call.
          </p>
          <PortalTeaser closeLabel="Close" />
        </div>
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
