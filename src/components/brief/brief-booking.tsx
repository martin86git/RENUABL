"use client";

import { Loader2 } from "lucide-react";
import { useMemo, useState } from "react";
import { ConsentBoxes, NO_CONSENT, type ConsentState } from "@/components/consumer/consent-boxes";
import { MonthCalendar } from "@/components/ui/month-calendar";
import { Button, cn } from "@/components/ui/primitives";
import { formatCallTime } from "@/lib/domain/booking";
import { formatDate } from "@/lib/domain/format";
import { LAUNCH_MARKET } from "@/lib/domain/market";
import { getCallAvailability } from "@/lib/services/consumer";
import { bookBriefCall, type BriefBookingInput } from "@/lib/services/brief";

export interface BriefBooked {
  call: string;
  /** "2026-10-06T11:30" */
  slot: string | null;
  emailed: boolean;
}

const field =
  "h-11 w-full rounded-xl border border-line bg-surface px-3.5 text-[15px] text-ink outline-none placeholder:text-muted focus:border-ink";

/** Pick a day and time, confirm the best number (and an email for the invite), book. */
export function BriefBooking({
  briefKey,
  mobile,
  email: knownEmail,
  payload,
  onBooked,
}: {
  briefKey: string;
  mobile: string | null;
  email: string | null;
  payload: () => Omit<BriefBookingInput, "date" | "time" | "phone" | "email" | "consent">;
  onBooked: (r: BriefBooked) => void;
}) {
  const availability = useMemo(() => getCallAvailability(null), []);
  const [date, setDate] = useState<string | null>(availability[0]?.date ?? null);
  const [time, setTime] = useState<string | null>(null);
  const [phone, setPhone] = useState(mobile ? mobile.replace(/^\+61/, "0") : "");
  const [email, setEmail] = useState(knownEmail ?? "");
  const [consent, setConsent] = useState<ConsentState>(NO_CONSENT);
  const [consentMissing, setConsentMissing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const day = availability.find((d) => d.date === date);

  async function book() {
    if (!date || !time) return setProblem("Choose a day and time for your call.");
    if (!consent.terms) return setConsentMissing(true);
    setBusy(true);
    setProblem(null);
    const r = await bookBriefCall(briefKey, { ...payload(), date, time, phone, email: email.trim() || undefined, consent });
    setBusy(false);
    if (r.ok && r.call) onBooked({ call: r.call, slot: r.date && r.time ? `${r.date}T${r.time}` : null, emailed: Boolean(r.emailed) });
    else setProblem(r.message ?? "That didn't go through. Please try again.");
  }

  return (
    <div className="space-y-5">
      <div className="rounded-[var(--radius-card)] bg-surface p-4 shadow-[var(--shadow-soft)]">
        <MonthCalendar
          available={availability.map((d) => d.date)}
          value={date}
          onChange={(d) => {
            setDate(d);
            setTime(null);
          }}
        />
        <p className="mt-4 text-[14px] text-ink">
          {day ? formatDate(day.date, { weekday: "long", day: "numeric", month: "long" }) : "Pick a day"}
        </p>
        <p className="text-[12px] text-muted">Times in {LAUNCH_MARKET.capital} time</p>
        <div className="mt-3 grid grid-cols-3 gap-2" role="radiogroup" aria-label="Call time">
          {day?.times.map((t) => (
            <button
              key={t}
              type="button"
              role="radio"
              aria-checked={time === t}
              onClick={() => setTime(t)}
              className={cn(
                "h-10 rounded-full text-[13.5px] tabular-nums transition",
                time === t ? "bg-primary text-primary-ink" : "bg-surface text-ink-2 shadow-[0_0_0_1px_var(--line)]",
              )}
            >
              {formatCallTime(t)}
            </button>
          ))}
        </div>
      </div>
      <div className="space-y-2">
        <label className="block">
          <span className="text-[13px] text-ink-2">What&apos;s the best number to call you on?</span>
          <input
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className={cn(field, "mt-1")}
          />
        </label>
        <label className="block">
          <span className="text-[13px] text-ink-2">Email for your calendar invite (optional)</span>
          <input
            type="email"
            inputMode="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={cn(field, "mt-1")}
          />
        </label>
      </div>
      <ConsentBoxes kind="follow-up" value={consent} onChange={setConsent} missing={consentMissing} />
      {problem && (
        <p className="text-[13px] text-danger" role="alert">
          {problem}
        </p>
      )}
      <Button size="lg" className="w-full" disabled={busy} onClick={() => void book()}>
        {busy ? (
          <Loader2 className="h-5 w-5 animate-spin" />
        ) : date && time ? (
          `Book ${formatDate(date, { weekday: "short", day: "numeric", month: "short" })} at ${formatCallTime(time)}`
        ) : (
          "Book my call"
        )}
      </Button>
    </div>
  );
}
