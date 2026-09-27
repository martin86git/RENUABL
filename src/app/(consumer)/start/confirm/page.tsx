"use client";

import { Check, Loader2, Phone } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { FlowGuard } from "@/components/consumer/flow-guard";
import { FlowStep } from "@/components/consumer/flow-shell";
import { useFlow } from "@/components/consumer/flow-state";
import { EnergyOrb } from "@/components/ui/energy-orb";
import { ButtonLink, Button, Card, cn } from "@/components/ui/primitives";
import { formatDate } from "@/lib/domain/format";
import { getWindow } from "@/lib/domain/scheduling";
import { bookConfirmationCall, getCallSlots } from "@/lib/services/consumer";

function ConfirmScreen() {
  const { state, update } = useFlow();
  const slots = useMemo(() => getCallSlots(), []);
  const [day, setDay] = useState(slots[0]?.date);
  const [time, setTime] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const times = slots.find((s) => s.date === day)?.times ?? [];
  const window = state.windowId ? getWindow(state.windowId) : undefined;

  async function book() {
    if (!day || !time) return;
    setBusy(true);
    const res = await bookConfirmationCall(day, time);
    update({ call: { date: res.date, time: res.time } });
    setBusy(false);
  }

  if (state.call) {
    return (
      <FlowStep title="You're all set" subtitle="Your date is reserved and your call is booked." wide>
        <Card className="mx-auto flex max-w-xl flex-col items-center p-8 text-center lg:mx-0 lg:items-start lg:text-left">
          <EnergyOrb size={140} mood="happy" />
          <div className="mt-6 w-full space-y-3 text-[15px]">
            <p className="flex items-center gap-2">
              <Check className="h-4 w-4 text-positive" /> Reservation {state.reservation?.reservationId} confirmed
            </p>
            <p className="flex items-center gap-2">
              <Check className="h-4 w-4 text-positive" /> Call on{" "}
              {formatDate(state.call.date, { weekday: "long", day: "numeric", month: "short" })} at {state.call.time}
            </p>
            {state.installDate && (
              <p className="flex items-center gap-2">
                <Check className="h-4 w-4 text-positive" /> Installation {formatDate(state.installDate)}
                {window ? `, arriving ${window.label}` : ""}
              </p>
            )}
          </div>
          <ButtonLink href="/my" size="lg" className="mt-8 w-full sm:w-auto">
            Go to My RENUABL
          </ButtonLink>
        </Card>
      </FlowStep>
    );
  }

  return (
    <FlowStep
      title="Book your 15-minute confirmation"
      subtitle="A quick check of your roof, switchboard and access, so install day just works. This isn't a sales call."
      cta={
        <Button size="lg" className="w-full lg:w-auto" disabled={!time || busy} onClick={() => void book()}>
          {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : time ? `Book ${time}` : "Choose a time"}
        </Button>
      }
      aside={
        <Card className="p-6">
          <Phone className="h-5 w-5 text-muted" />
          <p className="mt-3 text-[17px] font-semibold">What we&apos;ll confirm</p>
          <ul className="mt-2 space-y-2 text-[15px] text-ink-2">
            <li>• Roof type and any shading</li>
            <li>• Switchboard photo (we&apos;ll text you a link)</li>
            <li>• Access, parking and pets</li>
          </ul>
          <p className="mt-4 text-[13px] text-muted">If anything changes your price, you decide — or get a full refund.</p>
        </Card>
      }
    >
      <div className="rounded-2xl bg-positive-soft px-4 py-3 text-[15px] text-positive">
        <Check className="mr-1.5 inline h-4 w-4" />
        Reservation {state.reservation?.reservationId} received. Your date is held.
      </div>

      <div className="mt-8 flex gap-2 overflow-x-auto pb-1" role="radiogroup" aria-label="Call day">
        {slots.map((s) => (
          <button
            key={s.date}
            type="button"
            role="radio"
            aria-checked={day === s.date}
            onClick={() => {
              setDay(s.date);
              setTime(null);
            }}
            className={cn(
              "min-w-[104px] rounded-2xl border px-4 py-3 text-left transition",
              day === s.date ? "border-ink bg-ink text-canvas" : "border-line bg-surface hover:border-line-strong",
            )}
          >
            <span className="block text-[13px] opacity-70">{formatDate(s.date, { weekday: "short" })}</span>
            <span className="block text-[17px] font-semibold">{formatDate(s.date, { day: "numeric", month: "short" })}</span>
          </button>
        ))}
      </div>

      <div className="mt-5 grid grid-cols-3 gap-2 sm:grid-cols-4" role="radiogroup" aria-label="Call time">
        {times.map((t) => (
          <button
            key={t}
            type="button"
            role="radio"
            aria-checked={time === t}
            onClick={() => setTime(t)}
            className={cn(
              "h-12 rounded-full border text-[15px] font-medium tabular-nums transition",
              time === t ? "border-ink bg-ink text-canvas" : "border-line bg-surface hover:border-line-strong",
            )}
          >
            {t}
          </button>
        ))}
      </div>
      <p className="mt-6 text-[13px] text-muted">
        Prefer we call now?{" "}
        <Link href="/my/support" className="underline underline-offset-4">
          Contact support
        </Link>
      </p>
    </FlowStep>
  );
}

export default function ConfirmPage() {
  return (
    <FlowGuard step="confirm">
      <ConfirmScreen />
    </FlowGuard>
  );
}
