"use client";

import { CalendarCheck, Loader2, X } from "lucide-react";
import { Dialog } from "radix-ui";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/primitives";
import { HUBSPOT_MEETINGS_URL } from "@/lib/config";
import { hubspotEmbedSrc, isHubspotBookedMessage } from "@/lib/domain/booking";
import { useFlow } from "./flow-state";

/**
 * Self-service booking for the 15-minute confirmation call, using RENUABL's
 * HubSpot Meetings page embedded in a sheet. Falls back to "we'll be in
 * touch" when no HubSpot link is configured.
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

  if (!HUBSPOT_MEETINGS_URL) {
    return <span className="block text-[12.5px] leading-snug text-muted">We&apos;ll be in touch shortly to schedule your call.</span>;
  }

  if (state.callBooked) {
    return (
      <span className="flex items-center gap-1.5 text-[12.5px] leading-snug text-positive">
        <CalendarCheck className="h-4 w-4" strokeWidth={1.8} /> Booked — check your email for the details.
      </span>
    );
  }

  const src = hubspotEmbedSrc(HUBSPOT_MEETINGS_URL);

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
            Book my call
          </Button>
        </Dialog.Trigger>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-40 bg-black/25" />
          <Dialog.Content className="fixed inset-x-0 bottom-0 z-50 flex h-[92dvh] flex-col rounded-t-[28px] bg-canvas shadow-[var(--shadow-lift)] sm:inset-auto sm:left-1/2 sm:top-1/2 sm:h-[760px] sm:max-h-[92dvh] sm:w-[720px] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-[28px]">
            <div className="flex items-center justify-between px-6 pt-5">
              <Dialog.Title className="text-[18px] font-medium">Book your 15-minute confirmation</Dialog.Title>
              <Dialog.Close className="grid h-9 w-9 place-items-center rounded-full hover:bg-surface-2" aria-label="Close">
                <X className="h-5 w-5" />
              </Dialog.Close>
            </div>
            <Dialog.Description className="px-6 pt-1 text-[13px] text-muted">
              A quick check of your roof, switchboard and access. Not a sales call.
            </Dialog.Description>
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
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  );
}
