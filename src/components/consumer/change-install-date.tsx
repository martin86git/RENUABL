"use client";

import { Loader2, X } from "lucide-react";
import { Dialog } from "radix-ui";
import { useMemo, useState } from "react";
import { MonthCalendar } from "@/components/ui/month-calendar";
import { Button } from "@/components/ui/primitives";
import { formatDate } from "@/lib/domain/format";
import { INSTALL_ARRIVAL, SOLAR_VIC_DATE_NOTE } from "@/lib/domain/scheduling";
import { getAvailability, moveInstallDay } from "@/lib/services/consumer";
import { useFlow, useInstallLead } from "./flow-state";

/** "Change install date" on the confirmation page: pick another open day; emailed with a new invite. */
export function ChangeInstallDate() {
  const { state, update } = useFlow();
  const lead = useInstallLead();
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState<string | null>(state.installDate);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const available = useMemo(
    () => (state.installerId ? getAvailability(state.installerId, lead.days).map((d) => d.date) : []),
    [state.installerId, lead.days],
  );
  const reference = state.reservation?.reservationId;
  const email = state.contact?.email;
  if (!reference || !email || !available.length) return null;

  async function save() {
    if (!date || !reference || !email) return;
    if (date === state.installDate) return setOpen(false);
    setBusy(true);
    setProblem(null);
    const r = await moveInstallDay({ reference, email, firstName: state.contact?.firstName, installDate: date });
    setBusy(false);
    if (!r.ok) return setProblem(r.message ?? "That didn't work. Please try again.");
    update({ installDate: date, windowId: INSTALL_ARRIVAL.id });
    setOpen(false);
  }

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <button type="button" className="tap-area mt-1.5 text-[12.5px] font-medium text-forest underline underline-offset-4">
          Change install date
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/25" />
        <Dialog.Content className="fixed inset-x-0 bottom-0 z-50 flex max-h-[92dvh] flex-col rounded-t-[28px] bg-canvas shadow-[var(--shadow-lift)] sm:inset-auto sm:left-1/2 sm:top-1/2 sm:w-[520px] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-[28px]">
          <div className="flex items-center justify-between px-6 pt-5">
            <Dialog.Title className="text-[18px] font-medium">Change your install date</Dialog.Title>
            <Dialog.Close className="grid h-9 w-9 place-items-center rounded-full hover:bg-surface-2" aria-label="Close">
              <X className="h-5 w-5" />
            </Dialog.Close>
          </div>
          <Dialog.Description className="px-6 pt-1 text-[13px] text-muted">
            Pick another day. Your installation partner arrives between {INSTALL_ARRIVAL.label}.
          </Dialog.Description>
          <div className="overflow-y-auto px-6 pb-6 pt-4">
            <div className="rounded-2xl bg-surface p-4">
              <MonthCalendar available={available} value={date} onChange={setDate} />
            </div>
            {lead.solarVic && <p className="mt-3 text-[12.5px] text-muted">{SOLAR_VIC_DATE_NOTE}</p>}
            {problem && (
              <p className="mt-3 text-[13px] text-danger" role="alert">
                {problem}
              </p>
            )}
            <Button size="lg" className="mt-5 w-full" disabled={!date || busy} onClick={() => void save()}>
              {busy ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : date ? (
                `Move to ${formatDate(date, { weekday: "short", day: "numeric", month: "short" })}`
              ) : (
                "Choose a day"
              )}
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
