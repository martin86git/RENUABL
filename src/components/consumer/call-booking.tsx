"use client";

import { CalendarCheck, Loader2, X } from "lucide-react";
import { Dialog } from "radix-ui";
import { useEffect, useMemo, useState } from "react";
import { MonthCalendar } from "@/components/ui/month-calendar";
import { Button, cn } from "@/components/ui/primitives";
import { HUBSPOT_MEETINGS_URL } from "@/lib/config";
import { formatCallTime, hubspotEmbedSrc, isHubspotBookedMessage } from "@/lib/domain/booking";
import { formatDate } from "@/lib/domain/format";
import { LAUNCH_MARKET } from "@/lib/domain/market";
import { bookConfirmationCall, getCallAvailability, type CallSlot } from "@/lib/services/consumer";
import { useFlow } from "./flow-state";

/** In-app calendar for the call, used when no HubSpot link is configured. */
function CallPicker({ installDate, onBooked }: { installDate: string | null; onBooked: (slot: CallSlot) => void }) {
  const availability = useMemo(() => getCallAvailability(installDate), [installDate]);
  const [date, setDate] = useState<string | null>(availability[0]?.date ?? null);
  const [time, setTime] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const day = availability.find((d) => d.date === date);

  if (!availability.length) {
    return <p className="px-6 py-8 text-[14px] text-muted">We&apos;ll call you to find a time before your install.</p>;
  }

  async function confirm() {
    if (!date || !time) return;
    setBusy(true);
    onBooked(await bookConfirmationCall({ date, time }));
    setBusy(false);
  }

  return (
    <div className="flex-1 overflow-y-auto px-6 pb-6">
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-[minmax(0,1fr)_220px]">
        <div className="rounded-2xl bg-surface p-4">
          <MonthCalendar
            available={availability.map((d) => d.date)}
            value={date}
            onChange={(d) => {
              setDate(d);
              setTime(null);
            }}
          />
        </div>
        <div>
          <p className="text-[14px] text-ink">
            {day ? formatDate(day.date, { weekday: "long", day: "numeric", month: "long" }) : "Pick a day"}
          </p>
          <p className="text-[12px] text-muted">Times in {LAUNCH_MARKET.capital} time</p>
          <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-2" role="radiogroup" aria-label="Call time">
            {day?.times.map((t) => (
              <button
                key={t}
                type="button"
                role="radio"
                aria-checked={time === t}
                onClick={() => setTime(t)}
                className={cn(
                  "h-10 rounded-full text-[13.5px] tabular-nums transition",
                  time === t
                    ? "bg-primary text-primary-ink"
                    : "bg-surface text-ink-2 shadow-[0_0_0_1px_var(--line)] hover:shadow-[0_0_0_1px_var(--line-strong)]",
                )}
              >
                {formatCallTime(t)}
              </button>
            ))}
          </div>
        </div>
      </div>
      <Button size="lg" className="mt-6 w-full" disabled={!date || !time || busy} onClick={() => void confirm()}>
        {busy ? (
          <Loader2 className="h-5 w-5 animate-spin" />
        ) : date && time ? (
          `Book ${formatDate(date, { weekday: "short", day: "numeric", month: "short" })} at ${formatCallTime(time)}`
        ) : (
          "Choose a time"
        )}
      </Button>
    </div>
  );
}

/**
 * Self-service booking for the 15-minute confirmation call: RENUABL's HubSpot
 * Meetings page embedded in a sheet when configured, otherwise an in-app
 * calendar.
 */
export function CallBooking() {
  const { state, update } = useFlow();
  const [open, setOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!HUBSPOT_MEETINGS_URL) return;
    const onMessage = (e: MessageEvent) => {
      if (isHubspotBookedMessage(e.origin, e.data)) {
        update({ callBooked: true });
        setTimeout(() => setOpen(false), 1800);
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [update]);

  if (state.callBooked) {
    return (
      <span className="flex items-center gap-1.5 text-[12.5px] leading-snug text-positive">
        <CalendarCheck className="h-4 w-4 shrink-0" strokeWidth={1.8} />
        {state.call
          ? `Booked for ${formatDate(state.call.date, { weekday: "short", day: "numeric", month: "short" })} at ${formatCallTime(state.call.time)}. We'll call you then.`
          : "Booked — check your email for the details."}
      </span>
    );
  }

  const src = HUBSPOT_MEETINGS_URL ? hubspotEmbedSrc(HUBSPOT_MEETINGS_URL) : null;

  return (
    <>
      <span className="block text-[12.5px] leading-snug text-muted">Choose a time that suits you. It takes a minute.</span>
      <Dialog.Root
        open={open}
        onOpenChange={(o) => {
          setOpen(o);
          if (!o) setLoaded(false);
        }}
      >
        <Dialog.Trigger asChild>
          <Button size="sm" className="mt-2.5">
            {src ? "Book my call" : "Choose a date and time"}
          </Button>
        </Dialog.Trigger>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-40 bg-black/25" />
          <Dialog.Content
            className={cn(
              "fixed inset-x-0 bottom-0 z-50 flex max-h-[92dvh] flex-col rounded-t-[28px] bg-canvas shadow-[var(--shadow-lift)] sm:inset-auto sm:left-1/2 sm:top-1/2 sm:w-[720px] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-[28px]",
              src && "h-[92dvh] sm:h-[760px]",
            )}
          >
            <div className="flex items-center justify-between px-6 pt-5">
              <Dialog.Title className="text-[18px] font-medium">Book your 15-minute confirmation</Dialog.Title>
              <Dialog.Close className="grid h-9 w-9 place-items-center rounded-full hover:bg-surface-2" aria-label="Close">
                <X className="h-5 w-5" />
              </Dialog.Close>
            </div>
            <Dialog.Description className="px-6 pt-1 text-[13px] text-muted">
              A quick check of your roof, switchboard and access. Not a sales call.
            </Dialog.Description>
            {!src ? (
              <div className="mt-4 flex min-h-0 flex-1 flex-col">
                <CallPicker
                  installDate={state.installDate}
                  onBooked={(call) => {
                    update({ callBooked: true, call });
                    setOpen(false);
                  }}
                />
              </div>
            ) : (
              <div className="relative mt-3 flex-1 overflow-hidden px-2 pb-2 sm:px-4">
                {!loaded && (
                  <div className="absolute inset-0 grid place-items-center text-muted" aria-live="polite">
                    <Loader2 className="h-6 w-6 animate-spin" />
                  </div>
                )}
                <iframe
                  src={src}
                  title="Book your confirmation call"
                  onLoad={() => setLoaded(true)}
                  className="h-full w-full rounded-2xl bg-white"
                  allow="payment"
                />
              </div>
            )}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  );
}
